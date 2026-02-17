import { Db } from 'mongodb';
import { GraphV2Params, GraphV2Result, GraphEdge, GraphLayer, GraphNode } from './graphv2.types.js';
import { buildNodes } from './graphv2.builders.js';
import { filterEdges } from './graphv2.filters.js';
import { buildFollowGraph } from '../follow-graph/follow.service.js';

export async function buildGraphV2(
  db: Db,
  params: GraphV2Params
): Promise<GraphV2Result> {
  const { layer, anchors, minConfidence, minWeight, handle } = params;

  // If no handle provided, return empty graph
  if (!handle) {
    return {
      nodes: [],
      edges: [],
      meta: { layer, anchors },
    };
  }

  // 1. Get nodes centered around the searched handle
  const nodes = await buildNodesForHandle(db, handle, { anchors });

  if (nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      meta: { layer, anchors, searchHandle: handle },
    };
  }

  // 2. Generate edges based on layer
  let edges: GraphEdge[];
  
  if (layer === 'FOLLOW') {
    edges = await generateFollowEdges(db, nodes);
  } else if (layer === 'CO_INVEST') {
    edges = await generateCoInvestEdges(db, nodes);
  } else if (layer === 'BLENDED') {
    const followEdges = await generateFollowEdges(db, nodes);
    const coinvestEdges = await generateCoInvestEdges(db, nodes);
    edges = [...followEdges, ...coinvestEdges];
  } else {
    edges = generateMockEdges(nodes, layer);
  }

  // 3. Filters
  const filteredEdges = filterEdges(edges, { minConfidence, minWeight });

  return {
    nodes,
    edges: filteredEdges,
    meta: { layer, anchors, searchHandle: handle },
  };
}

/**
 * Build nodes centered around a specific handle
 */
async function buildNodesForHandle(
  db: Db, 
  handle: string, 
  options: { anchors: boolean }
): Promise<GraphNode[]> {
  const cleanHandle = handle.replace('@', '').toLowerCase();
  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();

  // 1. Find the target account from unified_accounts
  const targetAccount = await db.collection('connections_unified_accounts').findOne({
    $or: [
      { id: cleanHandle },
      { handle: { $regex: new RegExp(`^@?${cleanHandle}$`, 'i') } }
    ]
  });

  if (targetAccount) {
    const nodeId = targetAccount.id || cleanHandle;
    nodes.push({
      id: nodeId,
      kind: 'TWITTER',
      label: targetAccount.title || targetAccount.handle || cleanHandle,
      handle: cleanHandle,
      confidence: targetAccount.confidence || 0.8,
      seedAuthority: targetAccount.authority || 0.5,
    });
    nodeIds.add(nodeId);
  } else {
    // Create node even if not in database
    nodes.push({
      id: cleanHandle,
      kind: 'TWITTER',
      label: cleanHandle,
      handle: cleanHandle,
      confidence: 0.5,
    });
    nodeIds.add(cleanHandle);
  }

  // 2. Find related accounts (followers/following)
  const followEdges = await db.collection('parser_follow_edges')
    .find({
      $or: [
        { sourceUsername: { $regex: new RegExp(`^${cleanHandle}$`, 'i') } },
        { targetUsername: { $regex: new RegExp(`^${cleanHandle}$`, 'i') } }
      ]
    })
    .limit(50)
    .toArray();

  for (const edge of followEdges) {
    const relatedHandle = edge.sourceUsername?.toLowerCase() === cleanHandle 
      ? edge.targetUsername?.toLowerCase()
      : edge.sourceUsername?.toLowerCase();
    
    if (relatedHandle && !nodeIds.has(relatedHandle)) {
      nodeIds.add(relatedHandle);
      
      // Try to get more info from unified_accounts
      const relatedAccount = await db.collection('connections_unified_accounts').findOne({
        $or: [
          { id: relatedHandle },
          { handle: { $regex: new RegExp(`^@?${relatedHandle}$`, 'i') } }
        ]
      });

      nodes.push({
        id: relatedHandle,
        kind: 'TWITTER',
        label: relatedAccount?.title || relatedHandle,
        handle: relatedHandle,
        confidence: relatedAccount?.confidence || 0.6,
        seedAuthority: relatedAccount?.authority,
      });
    }
  }

  // 3. Add all unified accounts as potential connections
  const allAccounts = await db.collection('connections_unified_accounts')
    .find({})
    .limit(20)
    .toArray();

  for (const account of allAccounts) {
    const accId = account.id || account.handle?.replace('@', '').toLowerCase();
    if (accId && !nodeIds.has(accId)) {
      nodeIds.add(accId);
      nodes.push({
        id: accId,
        kind: 'TWITTER',
        label: account.title || account.handle || accId,
        handle: accId,
        confidence: account.confidence || 0.7,
        seedAuthority: account.authority,
      });
    }
  }

  // 4. Add backers if anchors enabled
  if (options.anchors) {
    const backers = await db.collection('connections_backers')
      .find({ status: 'ACTIVE' })
      .limit(10)
      .toArray();

    for (const backer of backers) {
      const backerId = `bkr_${backer.slug || backer.id}`;
      if (!nodeIds.has(backerId)) {
        nodeIds.add(backerId);
        nodes.push({
          id: backerId,
          kind: 'BACKER',
          label: backer.name,
          confidence: backer.confidence || 0.9,
          seedAuthority: backer.seedAuthority || 0.8,
        });
      }
    }
  }

  console.log(`[GraphV2] Built ${nodes.length} nodes for handle: ${cleanHandle}`);
  return nodes;
}

/**
 * Generate FOLLOW edges from parsed edges directly
 */
async function generateFollowEdges(db: Db, nodes: any[]): Promise<GraphEdge[]> {
  try {
    const nodeSet = new Set(nodes.map(n => n.id));
    console.log(`[GraphV2] Building follow edges for ${nodeSet.size} nodes`);
    
    // Get parsed edges directly from parser_follow_edges collection
    const parsedEdges = await getParsedFollowEdges(db, nodes);
    console.log(`[GraphV2] Found ${parsedEdges.length} follow edges`);
    
    return parsedEdges;
  } catch (err) {
    console.log('[GraphV2] Failed to build follow edges:', err);
    return [];
  }
}

/**
 * Get parsed follow edges from parser collections
 */
async function getParsedFollowEdges(db: Db, nodes: any[]): Promise<GraphEdge[]> {
  const edges: GraphEdge[] = [];
  const nodeSet = new Set(nodes.map(n => n.id));
  
  try {
    // Get following edges - both source and target should have nodes now
    const followingEdges = await db.collection('parser_follow_edges')
      .find({})
      .limit(1000)
      .toArray();
    
    for (const edge of followingEdges) {
      const sourceUsername = edge.sourceUsername?.toLowerCase();
      const targetUsername = edge.targetUsername?.toLowerCase();
      
      if (sourceUsername && targetUsername) {
        // Use simple username as ID (matching our nodes)
        const sourceId = sourceUsername;
        const targetId = targetUsername;
        
        // Only add edge if both nodes exist
        if (nodeSet.has(sourceId) && nodeSet.has(targetId)) {
          edges.push({
            source: sourceId,
            target: targetId,
            layer: 'FOLLOW' as GraphLayer,
            weight: 0.3 + (edge.targetFollowers > 100000 ? 0.3 : edge.targetFollowers > 10000 ? 0.2 : 0.1),
            confidence: edge.targetVerified ? 0.9 : 0.7,
            overlay: {
              source: 'parser_follow',
              status: 'ok',
              sourceUsername,
              targetUsername,
              targetFollowers: edge.targetFollowers,
              parsedAt: edge.parsedAt?.toISOString(),
            },
          });
        }
      }
    }
    
    console.log(`[GraphV2] getParsedFollowEdges: ${followingEdges.length} raw -> ${edges.length} matched edges`);
    
  } catch (err) {
    console.log('[GraphV2] Error getting parsed edges:', err);
  }
  
  return edges;
}

/**
 * PHASE A3: Generate CO_INVEST edges from backer network
 */
async function generateCoInvestEdges(db: Db, nodes: any[]): Promise<GraphEdge[]> {
  try {
    // Get latest co-investment snapshot
    const latestSnapshot = await db.collection('network_v2_snapshots')
      .findOne(
        { type: 'CO_INVESTMENT' },
        { sort: { createdAt: -1 } }
      );
    
    if (!latestSnapshot) {
      console.log('[GraphV2] No co-investment snapshot found, using mock');
      return generateMockEdges(nodes, 'CO_INVEST');
    }
    
    // Get edges from snapshot
    const edges = await db.collection('network_v2_edges')
      .find({ snapshotId: latestSnapshot.id, type: 'CO_INVESTMENT' })
      .limit(500)
      .toArray();
    
    console.log(`[GraphV2] Co-invest edges from snapshot: ${edges.length}`);
    
    // Map to graph edges
    const nodeSet = new Set(nodes.map(n => n.id));
    const filteredEdges = edges.filter((e: any) => 
      nodeSet.has(e.from) || nodeSet.has(e.to) ||
      e.from.startsWith('bkr_') || e.to.startsWith('bkr_')
    );
    
    return filteredEdges.map((e: any) => ({
      source: e.from,
      target: e.to,
      layer: 'CO_INVEST' as GraphLayer,
      weight: e.weight ?? 0.5,
      confidence: e.confidence ?? 0.8,
      overlay: {
        source: 'backer_coinvest',
        status: 'ok',
        sharedCount: e.sharedCount,
        sharedProjects: e.sharedProjects,
      },
    }));
  } catch (err) {
    console.log('[GraphV2] Failed to build co-invest edges:', err);
    return generateMockEdges(nodes, 'CO_INVEST');
  }
}

function generateMockEdges(nodes: any[], layer: GraphLayer): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const nodeIds = nodes.map(n => n.id);
  
  // Generate some random connections for demo
  for (let i = 0; i < Math.min(nodes.length * 2, 100); i++) {
    const sourceIdx = Math.floor(Math.random() * nodeIds.length);
    const targetIdx = Math.floor(Math.random() * nodeIds.length);
    
    if (sourceIdx === targetIdx) continue;
    
    const source = nodeIds[sourceIdx];
    const target = nodeIds[targetIdx];
    
    // Check if edge already exists
    if (edges.find(e => e.source === source && e.target === target)) continue;
    
    edges.push({
      source,
      target,
      layer,
      weight: 0.1 + Math.random() * 0.5,
      confidence: 0.6 + Math.random() * 0.35,
      overlay: { source: 'mock', status: 'ok' },
    });
  }
  
  return edges;
}
