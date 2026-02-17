/**
 * Graph Admin Routes - admin endpoints for graph configuration
 * 
 * Endpoints:
 * - GET /api/admin/connections/graph/config - get current config
 * - PATCH /api/admin/connections/graph/config - update config
 * - GET /api/admin/connections/graph/stats - get graph health stats
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getGraphConfig, updateGraphConfig } from '../core/graph/graph-config.js';
import { GraphConfigSchema, DEFAULT_GRAPH_CONFIG } from '../contracts/graph.contracts.js';
import { getMongoDb } from '../../../db/mongoose.js';

export async function graphAdminRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/admin/connections/graph/config
   * Get current graph configuration
   */
  fastify.get('/graph/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getGraphConfig();
      
      return {
        ok: true,
        data: config,
        defaults: DEFAULT_GRAPH_CONFIG,
      };
      
    } catch (err: any) {
      fastify.log.error(`[GraphAdmin] Config error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * PATCH /api/admin/connections/graph/config
   * Update graph configuration
   */
  fastify.patch('/graph/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      
      // Validate partial update
      const updates: Partial<typeof DEFAULT_GRAPH_CONFIG> = {};
      
      if (body.graph_enabled !== undefined) updates.graph_enabled = Boolean(body.graph_enabled);
      if (body.default_depth !== undefined) updates.default_depth = Number(body.default_depth);
      if (body.default_limit !== undefined) updates.default_limit = Number(body.default_limit);
      if (body.min_jaccard !== undefined) updates.min_jaccard = Number(body.min_jaccard);
      if (body.min_shared !== undefined) updates.min_shared = Number(body.min_shared);
      if (body.max_degree !== undefined) updates.max_degree = Number(body.max_degree);
      if (body.cache_ttl_seconds !== undefined) updates.cache_ttl_seconds = Number(body.cache_ttl_seconds);
      if (body.max_candidates !== undefined) updates.max_candidates = Number(body.max_candidates);
      if (body.force_charge !== undefined) updates.force_charge = Number(body.force_charge);
      if (body.force_spacing !== undefined) updates.force_spacing = Number(body.force_spacing);
      
      const newConfig = await updateGraphConfig(updates);
      
      return {
        ok: true,
        message: 'Graph config updated',
        data: newConfig,
      };
      
    } catch (err: any) {
      fastify.log.error(`[GraphAdmin] Config update error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/admin/connections/graph/stats
   * Get graph health statistics
   */
  fastify.get('/graph/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getMongoDb();
      const accountsColl = db.collection('connections_accounts');
      const scoresColl = db.collection('connections_scores');
      const audienceColl = db.collection('connections_audience');
      
      const [accountsCount, scoresCount, audienceCount] = await Promise.all([
        accountsColl.countDocuments(),
        scoresColl.countDocuments(),
        audienceColl.countDocuments(),
      ]);
      
      // Get some aggregated stats
      const scoreStats = await scoresColl.aggregate([
        {
          $group: {
            _id: null,
            avg_influence: { $avg: '$influence_score' },
            max_influence: { $max: '$influence_score' },
            breakouts: { $sum: { $cond: [{ $eq: ['$early_signal_badge', 'breakout'] }, 1, 0] } },
            rising: { $sum: { $cond: [{ $eq: ['$early_signal_badge', 'rising'] }, 1, 0] } },
          }
        }
      ]).toArray();
      
      const stats = scoreStats[0] || {};
      
      return {
        ok: true,
        data: {
          collections: {
            accounts: accountsCount,
            scores: scoresCount,
            audiences: audienceCount,
          },
          scoring: {
            avg_influence: Math.round(stats.avg_influence || 0),
            max_influence: Math.round(stats.max_influence || 0),
            breakout_signals: stats.breakouts || 0,
            rising_signals: stats.rising || 0,
          },
          health: {
            has_accounts: accountsCount > 0,
            has_scores: scoresCount > 0,
            has_audiences: audienceCount > 0,
            ready_for_graph: accountsCount > 0 && (scoresCount > 0 || audienceCount > 0),
          },
          timestamp: new Date().toISOString(),
        },
      };
      
    } catch (err: any) {
      fastify.log.error(`[GraphAdmin] Stats error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * POST /api/admin/connections/graph/reset-config
   * Reset config to defaults
   */
  fastify.post('/graph/reset-config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const newConfig = await updateGraphConfig(DEFAULT_GRAPH_CONFIG);
      
      return {
        ok: true,
        message: 'Graph config reset to defaults',
        data: newConfig,
      };
      
    } catch (err: any) {
      fastify.log.error(`[GraphAdmin] Reset error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[GraphAdmin] Routes registered at /api/admin/connections/graph');
}
