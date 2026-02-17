/**
 * Network Paths Engine
 * 
 * BFS shortest path + strongest path computation
 * Finds paths to elite/high authority nodes
 */

import { pathsConfig as cfg } from './paths-config.js';
import { 
  AuthorityTier, 
  NetworkPath, 
  PathNode, 
  PathsResponse,
  GraphNode,
  GraphEdge,
  GraphSnapshot,
} from './paths-types.js';
import { enhancePath } from './paths-explain.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function logistic01(x: number, k: number): number {
  return 1 - Math.exp(-k * Math.max(0, x));
}

/**
 * Build adjacency list from edges (undirected)
 */
function makeAdj(edges: GraphEdge[]): Map<string, { to: string; w: number }[]> {
  const adj = new Map<string, { to: string; w: number }[]>();
  
  const add = (a: string, b: string, w: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, w });
  };
  
  for (const e of edges) {
    const w = clamp01(e.weight_0_1 ?? e.strength ?? 0.5);
    add(e.from, e.to, w);
    add(e.to, e.from, w);
  }
  
  return adj;
}

/**
 * Create node map for quick lookup
 */
function nodeMap(nodes: GraphNode[]): Map<string, GraphNode> {
  const m = new Map<string, GraphNode>();
  for (const n of nodes) m.set(n.id, n);
  return m;
}

/**
 * Convert graph node to path node
 */
function toPathNode(n: GraphNode): PathNode {
  return {
    id: n.id,
    authority_score_0_1: clamp01(n.authority_score_0_1 ?? 0.5),
    authority_tier: (n.authority_tier ?? 'mid') as AuthorityTier,
    handle: n.handle,
    label: n.label,
  };
}

/**
 * BFS shortest path up to max depth
 */
function shortestPath(
  adj: Map<string, { to: string; w: number }[]>, 
  from: string, 
  to: string, 
  maxDepth: number
): string[] | null {
  if (from === to) return [from];
  
  const q: string[] = [from];
  const prev = new Map<string, string | null>();
  prev.set(from, null);
  
  const depth = new Map<string, number>();
  depth.set(from, 0);
  
  while (q.length) {
    const cur = q.shift()!;
    const d = depth.get(cur) ?? 0;
    if (d >= maxDepth) continue;
    
    for (const nb of adj.get(cur) ?? []) {
      if (prev.has(nb.to)) continue;
      prev.set(nb.to, cur);
      depth.set(nb.to, d + 1);
      
      if (nb.to === to) {
        const path: string[] = [];
        let x: string | null = to;
        while (x) {
          path.push(x);
          x = prev.get(x) ?? null;
        }
        path.reverse();
        return path;
      }
      q.push(nb.to);
    }
  }
  
  return null;
}

/**
 * DFS strongest path (by edge weights)
 */
function strongestPath(
  adj: Map<string, { to: string; w: number }[]>, 
  from: string, 
  to: string, 
  maxDepth: number
): string[] | null {
  let best: { path: string[]; score: number } | null = null;
  
  const dfs = (
    cur: string, 
    target: string, 
    depth: number, 
    visited: Set<string>, 
    path: string[], 
    scoreAcc: number
  ) => {
    if (depth > maxDepth) return;
    
    if (cur === target) {
      if (!best || scoreAcc > best.score) {
        best = { path: [...path], score: scoreAcc };
      }
      return;
    }
    
    for (const nb of adj.get(cur) ?? []) {
      if (visited.has(nb.to)) continue;
      visited.add(nb.to);
      path.push(nb.to);
      dfs(nb.to, target, depth + 1, visited, path, scoreAcc * (nb.w || 1));
      path.pop();
      visited.delete(nb.to);
    }
  };
  
  dfs(from, to, 0, new Set([from]), [from], 1);
  return best?.path ?? null;
}

/**
 * Calculate path metrics
 */
function calcMetrics(pathNodes: PathNode[]): { strength: number; authority_sum: number } {
  let strength = 1;
  let sum = 0;
  
  for (const n of pathNodes) {
    strength = Math.min(strength, n.authority_score_0_1);
    sum += n.authority_score_0_1;
  }
  
  return { strength: clamp01(strength), authority_sum: sum };
}

/**
 * Get hop decay factor
 */
function hopDecay(hops: number): number {
  return cfg.hop_decay[hops] ?? Math.pow(0.7, Math.max(0, hops - 1));
}

/**
 * Calculate contribution score
 */
function contribution(authority_sum: number, hops: number): number {
  const raw = authority_sum * hopDecay(hops);
  return clamp01(logistic01(raw, cfg.normalize.logistic_k));
}

/**
 * Pick target nodes (elite/high authority)
 */
function pickTargets(nodes: GraphNode[]): string[] {
  const eliteMin = cfg.target_thresholds.elite_min_authority;
  const highMin = cfg.target_thresholds.high_min_authority;
  
  const strong = nodes
    .map(n => ({ n, a: clamp01(n.authority_score_0_1 ?? 0.5) }))
    .filter(x => x.a >= highMin)
    .sort((a, b) => b.a - a.a)
    .slice(0, cfg.limits.targets_top_n)
    .map(x => x.n.id);
  
  const elite = nodes
    .map(n => ({ n, a: clamp01(n.authority_score_0_1 ?? 0.5) }))
    .filter(x => x.a >= eliteMin)
    .sort((a, b) => b.a - a.a)
    .slice(0, Math.max(5, Math.floor(cfg.limits.targets_top_n / 2)))
    .map(x => x.n.id);
  
  return Array.from(new Set([...elite, ...strong]));
}

/**
 * Build paths response for an account
 */
export function buildPathsResponse(
  snapshot: GraphSnapshot, 
  account_id: string, 
  max_depth?: number, 
  target_ids?: string[]
): PathsResponse {
  const depth = max_depth ?? cfg.max_depth;
  const adj = makeAdj(snapshot.edges);
  const nodesById = nodeMap(snapshot.nodes);
  
  const targets = target_ids?.length ? target_ids : pickTargets(snapshot.nodes);
  const paths: NetworkPath[] = [];
  
  for (const t of targets) {
    if (t === account_id) continue;
    
    // Shortest path
    const sp = shortestPath(adj, account_id, t, depth);
    if (sp) {
      const nodes = sp.map(id => toPathNode(nodesById.get(id) ?? { id }));
      const hops = Math.max(0, nodes.length - 1);
      const m = calcMetrics(nodes);
      paths.push({
        from: account_id,
        to: t,
        hops,
        nodes,
        strength: m.strength,
        authority_sum: m.authority_sum,
        contribution_0_1: contribution(m.authority_sum, hops),
        kind: 'shortest',
      });
    }
    
    // Strongest path (if different from shortest)
    const strong = strongestPath(adj, account_id, t, depth);
    if (strong && (!sp || strong.join('->') !== sp.join('->'))) {
      const nodes = strong.map(id => toPathNode(nodesById.get(id) ?? { id }));
      const hops = Math.max(0, nodes.length - 1);
      const m = calcMetrics(nodes);
      paths.push({
        from: account_id,
        to: t,
        hops,
        nodes,
        strength: m.strength,
        authority_sum: m.authority_sum,
        contribution_0_1: contribution(m.authority_sum, hops),
        kind: 'strongest',
      });
    }
  }
  
  // Add elite-specific paths
  const eliteCandidates = paths
    .filter(p => {
      const targetNode = nodesById.get(p.to);
      return (targetNode?.authority_tier ?? 'mid') === 'elite';
    })
    .sort((a, b) => b.contribution_0_1 - a.contribution_0_1)
    .slice(0, 2)
    .map(p => ({ ...p, kind: 'elite' as const }));
  
  // Merge and sort by contribution
  const merged = [...paths, ...eliteCandidates]
    .sort((a, b) => b.contribution_0_1 - a.contribution_0_1)
    .slice(0, cfg.limits.paths_top_n)
    .map(enhancePath); // Phase 3.4: Add badges and explain_text
  
  // Generate explain
  const topPath = merged[0];
  const bullets = [
    `Max depth: ${depth} hops`,
    `Targets considered: ${targets.length}`,
    `Top path contribution: ${Math.round((topPath?.contribution_0_1 ?? 0) * 100)}%`,
  ];
  
  const summary = merged.length
    ? `Account is embedded in the network via ${merged.length} meaningful paths.`
    : 'No meaningful paths found in current graph snapshot.';
  
  return {
    version: cfg.version,
    account_id,
    max_depth: depth,
    targets_considered: targets.length,
    paths: merged,
    explain: {
      summary,
      bullets,
    },
  };
}

/**
 * Generate mock graph for testing
 */
export function generateMockGraphForPaths(nodeCount: number = 20): GraphSnapshot {
  const tiers: AuthorityTier[] = ['elite', 'high', 'upper_mid', 'mid', 'low_mid', 'low'];
  const tierWeights = [0.05, 0.10, 0.15, 0.30, 0.20, 0.20];
  
  const nodes: GraphNode[] = [];
  
  for (let i = 0; i < nodeCount; i++) {
    // Pick tier based on weighted distribution
    let rand = Math.random();
    let tierIdx = 0;
    let cumulative = 0;
    for (let j = 0; j < tierWeights.length; j++) {
      cumulative += tierWeights[j];
      if (rand <= cumulative) {
        tierIdx = j;
        break;
      }
    }
    
    const tier = tiers[tierIdx];
    const tierRanges: Record<AuthorityTier, [number, number]> = {
      elite: [0.85, 1.0],
      high: [0.70, 0.84],
      upper_mid: [0.55, 0.69],
      mid: [0.40, 0.54],
      low_mid: [0.25, 0.39],
      low: [0.10, 0.24],
    };
    
    const [min, max] = tierRanges[tier];
    const authority = min + Math.random() * (max - min);
    
    nodes.push({
      id: `node_${String(i + 1).padStart(3, '0')}`,
      authority_score_0_1: Number(authority.toFixed(4)),
      authority_tier: tier,
      handle: `user_${i + 1}`,
      label: `Account ${i + 1}`,
    });
  }
  
  // Generate edges (network connections)
  const edges: GraphEdge[] = [];
  const edgeCount = Math.floor(nodeCount * 2);
  
  for (let i = 0; i < edgeCount; i++) {
    const fromIdx = Math.floor(Math.random() * nodeCount);
    let toIdx = Math.floor(Math.random() * nodeCount);
    if (toIdx === fromIdx) {
      toIdx = (toIdx + 1) % nodeCount;
    }
    
    edges.push({
      from: nodes[fromIdx].id,
      to: nodes[toIdx].id,
      weight_0_1: 0.3 + Math.random() * 0.6,
    });
  }
  
  return { nodes, edges };
}
