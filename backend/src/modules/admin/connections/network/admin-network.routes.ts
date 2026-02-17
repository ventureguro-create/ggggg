/**
 * Admin Network Routes
 * 
 * Control co-engagement network configuration.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { getMongoDb } from '../../../../db/mongoose.js';
import {
  getNetworkConfig,
  updateNetworkConfig,
  buildNetworkGraph,
  getNetworkStatus,
  type NetworkMode,
} from '../../../connections/network/network-adapter.service.js';
import {
  getCoEngagementConfig,
  updateCoEngagementConfig,
  buildCoEngagementGraphV2,
} from '../../../connections/network/coengagement/coengagement-graph.builder.js';
import {
  getNetworkWeightConfig,
  updateNetworkWeightConfig,
} from '../../../connections/network/network-weight.policy.js';

export async function registerAdminNetworkRoutes(app: FastifyInstance) {
  
  // GET /status - Full status
  app.get('/status', async () => {
    const db = getMongoDb();
    const networkStatus = await getNetworkStatus(db);
    const graph = networkStatus.enabled ? await buildNetworkGraph(db) : null;
    const coConfig = getCoEngagementConfig();
    const weightConfig = getNetworkWeightConfig();
    
    return {
      ok: true,
      data: {
        network: {
          ...networkStatus,
          config: getNetworkConfig(),
        },
        co_engagement: {
          enabled: coConfig.enabled,
          edges_count: graph?.stats.co_engagement_edges || 0,
          config: coConfig,
        },
        weight_policy: weightConfig,
        graph: graph ? {
          edges_count: graph.stats.total_edges,
          avg_weight: graph.stats.avg_weight,
          avg_confidence: graph.stats.avg_confidence,
        } : null,
        warnings: graph?.warnings || [],
      },
    };
  });

  // POST /enable - Enable network
  app.post('/enable', async () => {
    const config = updateNetworkConfig({ mode: 'CO_ONLY' });
    updateCoEngagementConfig({ enabled: true });
    console.log('[AdminNetwork] Network enabled');
    return { ok: true, data: config };
  });

  // POST /disable - Disable network
  app.post('/disable', async () => {
    const config = updateNetworkConfig({ mode: 'OFF' });
    updateCoEngagementConfig({ enabled: false });
    console.log('[AdminNetwork] Network disabled');
    return { ok: true, data: config };
  });

  // PATCH /mode - Set network mode
  app.patch('/mode', async (req: FastifyRequest) => {
    const { mode } = req.body as { mode: NetworkMode };
    if (!['OFF', 'CO_ONLY', 'BLENDED'].includes(mode)) {
      return { ok: false, error: 'Invalid mode' };
    }
    const config = updateNetworkConfig({ mode });
    return { ok: true, data: config };
  });

  // PATCH /thresholds - Update thresholds
  app.patch('/thresholds', async (req: FastifyRequest) => {
    const { similarity, max_edges, weight_cap, confidence } = req.body as any;
    
    if (similarity !== undefined) {
      updateCoEngagementConfig({ min_similarity_threshold: similarity });
    }
    if (max_edges !== undefined) {
      updateCoEngagementConfig({ max_total_edges: max_edges });
    }
    if (weight_cap !== undefined) {
      updateNetworkConfig({ weight_cap });
    }
    if (confidence !== undefined) {
      updateNetworkConfig({ confidence_required: confidence });
    }
    
    return {
      ok: true,
      data: {
        network: getNetworkConfig(),
        co_engagement: getCoEngagementConfig(),
      },
    };
  });

  // PATCH /weight-policy - Update weight policy
  app.patch('/weight-policy', async (req: FastifyRequest) => {
    const updates = req.body as any;
    const config = updateNetworkWeightConfig(updates);
    return { ok: true, data: config };
  });

  // POST /preview - Preview graph
  app.post('/preview', async () => {
    const db = getMongoDb();
    const graph = await buildNetworkGraph(db);
    const coGraph = await buildCoEngagementGraphV2(db);
    
    return {
      ok: true,
      data: {
        network_edges: graph.edges.slice(0, 20).map(e => ({
          from: e.from_id,
          to: e.to_id,
          weight: e.weight.toFixed(3),
          source: e.source,
        })),
        co_engagement_edges: coGraph.edges.slice(0, 20).map(e => ({
          from: e.from_username,
          to: e.to_username,
          similarity: e.weight.toFixed(3),
        })),
        stats: {
          network: graph.stats,
          co_engagement: coGraph.stats,
        },
      },
    };
  });

  // POST /emergency-disable - Emergency disable
  app.post('/emergency-disable', async () => {
    updateNetworkConfig({ mode: 'OFF', weight_cap: 0 });
    updateCoEngagementConfig({ enabled: false });
    updateNetworkWeightConfig({ enabled: false, max_weight: 0 });
    console.log('[AdminNetwork] Emergency disable activated');
    return { ok: true, message: 'Network emergency disabled' };
  });

  console.log('[AdminNetwork] Routes registered at /api/admin/connections/network/*');
}
