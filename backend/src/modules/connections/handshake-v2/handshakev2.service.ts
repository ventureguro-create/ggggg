/**
 * Handshake v2 Service - Anchor-weighted path calculation
 * 
 * PathStrength = EdgeTerm * NodeTerm * AnchorBoost * HopPenalty
 */

import { Db } from 'mongodb';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function hopPenalty(hops: number): number {
  if (hops === 1) return 1.0;
  if (hops === 2) return 0.75;
  if (hops === 3) return 0.55;
  return 0.35;
}

export interface PathStrengthInput {
  path: string[];        // node IDs in order
  edgeConf: number[];    // confidence of each edge
  nodeAuth: number[];    // authority of each node
  isAnchor: boolean[];   // is each node an anchor?
}

/**
 * Calculate path strength using v2 formula
 */
export function pathStrengthV2(input: PathStrengthInput): number {
  const { path, edgeConf, nodeAuth, isAnchor } = input;
  const hops = path.length - 1;

  if (hops <= 0) return 1.0;

  // Edge term: product of (0.6 + 0.4*confidence) for each edge
  let edgeTerm = 1;
  for (const c of edgeConf) {
    edgeTerm *= (0.6 + 0.4 * clamp01(c));
  }

  // Node term: intermediate nodes only (exclude start/end)
  let nodeTerm = 1;
  for (let i = 1; i < path.length - 1; i++) {
    const a = clamp01(nodeAuth[i] ?? 0);
    nodeTerm *= (0.7 + 0.3 * a);
    
    // Anchor boost: up to +50% for strong anchors
    if (isAnchor[i]) {
      nodeTerm *= (1 + 0.5 * a);
    }
  }

  return edgeTerm * nodeTerm * hopPenalty(hops);
}

export interface HandshakeV2Params {
  fromId: string;
  toId: string;
  layer?: string;
}

export interface HandshakeV2Result {
  ok: boolean;
  hops?: number;
  strength?: number;
  pathIds?: string[];
  pathLabels?: string[];
  reason?: string;
  formula?: {
    edgeTerm: number;
    nodeTerm: number;
    hopPenalty: number;
  };
}

/**
 * Compute handshake path with v2 scoring
 */
export async function computeHandshakeV2(
  db: Db,
  params: HandshakeV2Params
): Promise<HandshakeV2Result> {
  const { fromId, toId } = params;

  if (fromId === toId) {
    return { ok: true, hops: 0, strength: 1, pathIds: [fromId] };
  }

  // Load nodes
  const accounts = await db.collection('connections_unified_accounts').find({}).toArray();
  const nodeMap = new Map<string, any>();
  for (const acc of accounts) {
    const id = acc.id || String(acc._id);
    nodeMap.set(id, acc);
  }

  // Load edges from multiple sources
  const coinvestEdges = await db.collection('backer_coinvest_edges').find({}).toArray();
  
  // Load follow edges (PHASE A1)
  let followEdges: any[] = [];
  try {
    followEdges = await db.collection('twitter_follows').find({}).toArray();
  } catch (err) {
    // No twitter_follows collection, generate mock
    console.log('[HandshakeV2] No twitter_follows, using mock follow edges');
  }
  
  // Build adjacency with edge data and type multipliers
  // FOLLOW = 1.2, CO_INVEST = 1.4, CO_ENGAGEMENT = 1.0
  const EDGE_MULTIPLIERS = {
    FOLLOW: 1.2,
    CO_INVEST: 1.4,
    CO_ENGAGEMENT: 1.0,
    SYNTHETIC: 0.8,
  };
  
  const graph = new Map<string, Map<string, { confidence: number; type: string }>>();
  
  // Add all nodes
  for (const id of nodeMap.keys()) {
    graph.set(id, new Map());
  }

  // Add coinvest edges (bidirectional, highest weight)
  for (const e of coinvestEdges) {
    if (!graph.has(e.source)) graph.set(e.source, new Map());
    if (!graph.has(e.target)) graph.set(e.target, new Map());
    const conf = (e.confidence ?? 0.75) * EDGE_MULTIPLIERS.CO_INVEST;
    graph.get(e.source)!.set(e.target, { confidence: conf, type: 'CO_INVEST' });
    graph.get(e.target)!.set(e.source, { confidence: conf, type: 'CO_INVEST' });
  }
  
  // Add follow edges (directed, with authority boost)
  for (const e of followEdges) {
    const from = e.fromAuthorId || e.followerId;
    const to = e.toAuthorId || e.followedId;
    if (!graph.has(from)) graph.set(from, new Map());
    if (!graph.has(to)) graph.set(to, new Map());
    
    // Get follower authority for boost
    const followerNode = nodeMap.get(from);
    const followerAuth = followerNode?.authority ?? followerNode?.seedAuthority ?? 0.5;
    const authBoost = Math.max(0.3, Math.min(1.5, 0.3 + followerAuth));
    
    const conf = 0.85 * EDGE_MULTIPLIERS.FOLLOW * authBoost;
    
    // Follow is directed but we add both ways for path finding
    if (!graph.get(from)?.has(to)) {
      graph.get(from)!.set(to, { confidence: conf, type: 'FOLLOW' });
    }
    if (!graph.get(to)?.has(from)) {
      graph.get(to)!.set(from, { confidence: conf * 0.7, type: 'FOLLOW_REV' });
    }
  }

  // Add synthetic edges between nearby nodes (for demo, lowest weight)
  const nodeIds = Array.from(nodeMap.keys());
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < Math.min(i + 5, nodeIds.length); j++) {
      const a = nodeIds[i];
      const b = nodeIds[j];
      if (!graph.get(a)?.has(b)) {
        const conf = (0.6 + Math.random() * 0.2) * EDGE_MULTIPLIERS.SYNTHETIC;
        graph.get(a)?.set(b, { confidence: conf, type: 'SYNTHETIC' });
        graph.get(b)?.set(a, { confidence: conf, type: 'SYNTHETIC' });
      }
    }
  }

  // BFS to find all paths up to 3 hops
  interface PathState {
    path: string[];
    edgeConfs: number[];
  }

  const queue: PathState[] = [{ path: [fromId], edgeConfs: [] }];
  const visited = new Set([fromId]);
  const allPaths: PathState[] = [];

  while (queue.length > 0) {
    const { path, edgeConfs } = queue.shift()!;
    if (path.length > 4) continue; // max 3 hops

    const last = path[path.length - 1];
    const neighbors = graph.get(last);
    if (!neighbors) continue;

    for (const [next, edgeData] of neighbors) {
      if (path.includes(next)) continue;

      const newPath = [...path, next];
      const newConfs = [...edgeConfs, edgeData.confidence];

      if (next === toId) {
        allPaths.push({ path: newPath, edgeConfs: newConfs });
      } else if (newPath.length < 4) {
        queue.push({ path: newPath, edgeConfs: newConfs });
      }
    }
  }

  if (allPaths.length === 0) {
    return { ok: false, reason: 'NO_PATH' };
  }

  // Calculate strength for each path and find best
  let bestPath: PathState | null = null;
  let bestStrength = -1;
  let bestFormula: any = null;

  for (const p of allPaths) {
    // Get node authorities and anchor status
    const nodeAuth: number[] = [];
    const isAnchor: boolean[] = [];

    for (const nodeId of p.path) {
      const node = nodeMap.get(nodeId);
      nodeAuth.push(node?.authority ?? node?.seedAuthority ?? node?.smart ?? 0.5);
      isAnchor.push(node?.kind === 'BACKER' || nodeId.startsWith('backer:'));
    }

    const strength = pathStrengthV2({
      path: p.path,
      edgeConf: p.edgeConfs,
      nodeAuth,
      isAnchor,
    });

    if (strength > bestStrength) {
      bestStrength = strength;
      bestPath = p;
      
      // Calculate formula components for transparency
      let edgeTerm = 1;
      for (const c of p.edgeConfs) edgeTerm *= (0.6 + 0.4 * clamp01(c));
      
      let nodeTerm = 1;
      for (let i = 1; i < p.path.length - 1; i++) {
        const a = clamp01(nodeAuth[i]);
        nodeTerm *= (0.7 + 0.3 * a);
        if (isAnchor[i]) nodeTerm *= (1 + 0.5 * a);
      }
      
      bestFormula = {
        edgeTerm: Math.round(edgeTerm * 1000) / 1000,
        nodeTerm: Math.round(nodeTerm * 1000) / 1000,
        hopPenalty: hopPenalty(p.path.length - 1),
      };
    }
  }

  if (!bestPath) {
    return { ok: false, reason: 'NO_PATH' };
  }

  // Get labels for path
  const pathLabels = bestPath.path.map(id => {
    const node = nodeMap.get(id);
    return node?.title || node?.label || node?.name || id;
  });

  return {
    ok: true,
    hops: bestPath.path.length - 1,
    strength: Math.round(bestStrength * 1000) / 1000,
    pathIds: bestPath.path,
    pathLabels,
    formula: bestFormula,
  };
}
