/**
 * Network Routes
 * 
 * API for network status and preview.
 * READ-ONLY.
 */

import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { buildNetworkGraph, getNetworkStatus, getNetworkConfig } from './network-adapter.service.js';
import { buildCoEngagementGraphV2, getCoEngagementConfig } from './coengagement/coengagement-graph.builder.js';

export async function registerNetworkRoutes(app: FastifyInstance) {
  
  // GET /status - Network status
  app.get('/status', async () => {
    const db = getMongoDb();
    const status = await getNetworkStatus(db);
    return { ok: true, data: status };
  });

  // GET /stats - Detailed statistics
  app.get('/stats', async () => {
    const db = getMongoDb();
    const graph = await buildNetworkGraph(db);
    return {
      ok: true,
      data: {
        success: graph.success,
        mode: graph.mode,
        source: graph.source,
        stats: graph.stats,
        warnings: graph.warnings,
      },
    };
  });

  // GET /top-edges - Top edges by weight
  app.get('/top-edges', async (req) => {
    const { limit = '20' } = req.query as { limit?: string };
    const db = getMongoDb();
    const graph = await buildNetworkGraph(db);
    
    const topEdges = graph.edges
      .sort((a, b) => b.weight - a.weight)
      .slice(0, parseInt(limit))
      .map(e => ({
        from: e.from_id,
        to: e.to_id,
        weight: e.weight.toFixed(3),
        confidence: e.confidence.toFixed(3),
        source: e.source,
      }));
    
    return { ok: true, data: topEdges };
  });

  // POST /preview - Preview network without applying
  app.post('/preview', async () => {
    const db = getMongoDb();
    const graph = await buildNetworkGraph(db);
    const coGraph = await buildCoEngagementGraphV2(db);
    
    return {
      ok: true,
      data: {
        mode: 'PREVIEW',
        network: {
          edges_count: graph.stats.total_edges,
          avg_weight: graph.stats.avg_weight,
          avg_confidence: graph.stats.avg_confidence,
        },
        co_engagement: {
          edges_count: coGraph.edges.length,
          avg_similarity: coGraph.stats.avg_similarity,
          nodes_count: coGraph.stats.nodes_count,
        },
        config: {
          network: getNetworkConfig(),
          co_engagement: getCoEngagementConfig(),
        },
      },
    };
  });

  // GET /config - Get config
  app.get('/config', async () => {
    return {
      ok: true,
      data: {
        network: getNetworkConfig(),
        co_engagement: getCoEngagementConfig(),
      },
    };
  });

  console.log('[Network] Routes registered');
}
