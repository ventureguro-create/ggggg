/**
 * Truth Graph Admin Routes
 * 
 * PHASE H4: Admin API for exploring the truth graph
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { TruthGraphBuilder } from '../services/truth-graph-builder.service';
import { TruthGraphQuery } from '../models/truth-graph.types';

export async function truthGraphAdminRoutes(app: FastifyInstance, db: Db) {
  const builder = new TruthGraphBuilder(db);
  
  /**
   * GET /api/admin/truth-graph
   * Build and return the truth graph
   */
  app.get('/api/admin/truth-graph', async (req, reply) => {
    const q = req.query as any;
    
    const query: TruthGraphQuery = {
      actorIds: q.actors ? q.actors.split(',') : undefined,
      assets: q.assets ? q.assets.split(',') : undefined,
      window: q.window,
      minIPS: q.minIPS ? Number(q.minIPS) : undefined,
      minTruthWeight: q.minTruthWeight ? Number(q.minTruthWeight) : undefined,
      verdict: q.verdict ? q.verdict.split(',') : undefined,
      from: q.from ? Number(q.from) : undefined,
      to: q.to ? Number(q.to) : undefined,
      maxNodes: Math.min(Number(q.maxNodes) || 200, 500),
      maxEdges: Math.min(Number(q.maxEdges) || 500, 1000),
      includeCorrelations: q.includeCorrelations === 'true'
    };
    
    const graph = await builder.buildGraph(query);
    
    return reply.send({
      ok: true,
      query,
      data: graph
    });
  });
  
  /**
   * GET /api/admin/truth-graph/actor/:actorId
   * Get subgraph centered on an actor
   */
  app.get('/api/admin/truth-graph/actor/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const q = req.query as any;
    
    const query: TruthGraphQuery = {
      actorIds: [actorId],
      window: q.window,
      maxNodes: 100,
      maxEdges: 200,
      includeCorrelations: true
    };
    
    const graph = await builder.buildGraph(query);
    
    return reply.send({
      ok: true,
      actorId,
      data: graph
    });
  });
  
  /**
   * GET /api/admin/truth-graph/asset/:symbol
   * Get subgraph centered on an asset
   */
  app.get('/api/admin/truth-graph/asset/:symbol', async (req, reply) => {
    const { symbol } = req.params as any;
    const q = req.query as any;
    
    const query: TruthGraphQuery = {
      assets: [symbol],
      window: q.window,
      maxNodes: 100,
      maxEdges: 200,
      includeCorrelations: true
    };
    
    const graph = await builder.buildGraph(query);
    const influencePath = await builder.getAssetInfluencePath(symbol);
    
    return reply.send({
      ok: true,
      asset: symbol.toUpperCase(),
      influencePath,
      data: graph
    });
  });
  
  /**
   * GET /api/admin/truth-graph/correlations
   * Get actor-to-actor correlations
   */
  app.get('/api/admin/truth-graph/correlations', async (req, reply) => {
    const q = req.query as any;
    
    const query: TruthGraphQuery = {
      actorIds: q.actors ? q.actors.split(',') : undefined,
      assets: q.assets ? q.assets.split(',') : undefined,
      maxNodes: 300,
      maxEdges: 500,
      includeCorrelations: true
    };
    
    const graph = await builder.buildGraph(query);
    
    // Filter to only correlation edges
    const correlationEdges = graph.edges.filter(e => 
      ['AMPLIFIES', 'PRECEDES', 'CORRELATED_WITH'].includes(e.type)
    );
    
    // Get unique actors involved
    const actorNodes = graph.nodes.filter(n => n.type === 'ACTOR');
    
    return reply.send({
      ok: true,
      data: {
        actors: actorNodes,
        correlations: correlationEdges,
        stats: {
          totalActors: actorNodes.length,
          totalCorrelations: correlationEdges.length,
          avgCorrelationStrength: correlationEdges.length > 0
            ? Math.round(correlationEdges.reduce((s, e) => s + e.weight, 0) / correlationEdges.length * 1000) / 1000
            : 0
        }
      }
    });
  });
  
  /**
   * GET /api/admin/truth-graph/paths
   * Query specific paths in the graph
   */
  app.get('/api/admin/truth-graph/paths', async (req, reply) => {
    const q = req.query as any;
    
    if (!q.from || !q.to) {
      return reply.status(400).send({
        ok: false,
        error: 'Both "from" and "to" parameters required (actor:id or asset:SYMBOL)'
      });
    }
    
    // Build graph with both endpoints
    const fromType = q.from.split(':')[0];
    const fromId = q.from.split(':')[1];
    const toType = q.to.split(':')[0];
    const toId = q.to.split(':')[1];
    
    const query: TruthGraphQuery = {
      actorIds: [fromType === 'actor' ? fromId : undefined, toType === 'actor' ? toId : undefined].filter(Boolean) as string[],
      assets: [fromType === 'asset' ? fromId : undefined, toType === 'asset' ? toId : undefined].filter(Boolean) as string[],
      maxNodes: 200,
      maxEdges: 400,
      includeCorrelations: true
    };
    
    const graph = await builder.buildGraph(query);
    
    // Simple path finding (BFS)
    const paths = findPaths(graph.nodes, graph.edges, q.from, q.to, 4);
    
    return reply.send({
      ok: true,
      from: q.from,
      to: q.to,
      paths,
      subgraph: graph
    });
  });
  
  /**
   * GET /api/admin/truth-graph/summary
   * Overall graph statistics
   */
  app.get('/api/admin/truth-graph/summary', async (req, reply) => {
    const col = db.collection('ips_events');
    
    // Overall stats
    const stats = await col.aggregate([
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          uniqueActors: { $addToSet: '$actorId' },
          uniqueAssets: { $addToSet: '$asset' },
          avgIPS: { $avg: '$ips' }
        }
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          uniqueActors: { $size: '$uniqueActors' },
          uniqueAssets: { $size: '$uniqueAssets' },
          avgIPS: { $round: ['$avgIPS', 3] }
        }
      }
    ]).toArray();
    
    // Top actors by IPS
    const topActors = await col.aggregate([
      {
        $group: {
          _id: '$actorId',
          avgIPS: { $avg: '$ips' },
          eventCount: { $sum: 1 }
        }
      },
      { $match: { eventCount: { $gte: 5 } } },
      { $sort: { avgIPS: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    // Top assets by activity
    const topAssets = await col.aggregate([
      {
        $group: {
          _id: '$asset',
          eventCount: { $sum: 1 },
          avgIPS: { $avg: '$ips' }
        }
      },
      { $sort: { eventCount: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    // Outcome distribution
    const outcomes = await col.aggregate([
      {
        $group: {
          _id: '$outcome',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    return reply.send({
      ok: true,
      data: {
        overview: stats[0] || { totalEvents: 0, uniqueActors: 0, uniqueAssets: 0, avgIPS: 0 },
        topActors: topActors.map(a => ({
          actorId: a._id,
          avgIPS: Math.round(a.avgIPS * 1000) / 1000,
          eventCount: a.eventCount
        })),
        topAssets: topAssets.map(a => ({
          asset: a._id,
          eventCount: a.eventCount,
          avgIPS: Math.round(a.avgIPS * 1000) / 1000
        })),
        outcomeDistribution: outcomes.reduce((obj, o) => {
          obj[o._id] = o.count;
          return obj;
        }, {} as Record<string, number>)
      }
    });
  });
  
  console.log('[TruthGraph] Admin routes registered: /api/admin/truth-graph/*');
}

/**
 * Simple BFS path finder
 */
function findPaths(
  nodes: any[],
  edges: any[],
  fromId: string,
  toId: string,
  maxDepth: number
): any[] {
  const adjacency = new Map<string, string[]>();
  
  for (const edge of edges) {
    const sources = adjacency.get(edge.source) || [];
    sources.push(edge.target);
    adjacency.set(edge.source, sources);
    
    // Bidirectional for correlation edges
    if (['CORRELATED_WITH', 'AMPLIFIES'].includes(edge.type)) {
      const targets = adjacency.get(edge.target) || [];
      targets.push(edge.source);
      adjacency.set(edge.target, targets);
    }
  }
  
  const paths: string[][] = [];
  const queue: { node: string; path: string[] }[] = [{ node: fromId, path: [fromId] }];
  const visited = new Set<string>();
  
  while (queue.length > 0 && paths.length < 5) {
    const { node, path } = queue.shift()!;
    
    if (node === toId) {
      paths.push(path);
      continue;
    }
    
    if (path.length >= maxDepth) continue;
    if (visited.has(node)) continue;
    visited.add(node);
    
    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }
  }
  
  return paths;
}
