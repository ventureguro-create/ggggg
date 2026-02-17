/**
 * Network Paths Admin Routes
 * 
 * Prefix: /api/admin/connections/paths
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  pathsConfig, 
  updatePathsConfig, 
  getPathsConfig,
  PathsConfig,
} from '../core/paths/index.js';

export async function registerPathsAdminRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/admin/connections/paths/config
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: getPathsConfig(),
    });
  });
  
  /**
   * PATCH /api/admin/connections/paths/config
   */
  app.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Partial<PathsConfig>;
    
    // Validate max_depth
    if (body.max_depth !== undefined && (body.max_depth < 1 || body.max_depth > 5)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_MAX_DEPTH',
        message: 'max_depth must be between 1 and 5',
      });
    }
    
    // Validate exposure weights
    if (body.exposure) {
      const sum = 
        (body.exposure.w_reachable_elite ?? pathsConfig.exposure.w_reachable_elite) +
        (body.exposure.w_reachable_high ?? pathsConfig.exposure.w_reachable_high) +
        (body.exposure.w_inverse_avg_hops ?? pathsConfig.exposure.w_inverse_avg_hops);
      
      if (Math.abs(sum - 1) > 0.01) {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_EXPOSURE_WEIGHTS',
          message: 'Exposure weights must sum to 1.0',
        });
      }
    }
    
    const updated = updatePathsConfig(body);
    
    return reply.send({
      ok: true,
      message: 'Paths config updated',
      data: updated,
    });
  });
  
  /**
   * POST /api/admin/connections/paths/reset
   * Reset to default configuration
   */
  app.post('/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    const defaults: Partial<PathsConfig> = {
      max_depth: 3,
      hop_decay: { 1: 1.0, 2: 0.72, 3: 0.52 },
      target_thresholds: {
        elite_min_authority: 0.80,
        high_min_authority: 0.65,
      },
      normalize: { method: 'logistic', logistic_k: 0.9 },
      limits: { targets_top_n: 15, paths_top_n: 6 },
      exposure: {
        w_reachable_elite: 0.40,
        w_reachable_high: 0.35,
        w_inverse_avg_hops: 0.25,
      },
      exposure_tiers: { elite: 0.80, strong: 0.55, moderate: 0.30 },
      enabled: true,
    };
    
    const updated = updatePathsConfig(defaults);
    
    return reply.send({
      ok: true,
      message: 'Paths config reset to defaults',
      data: updated,
    });
  });
  
  /**
   * POST /api/admin/connections/paths/enable
   */
  app.post('/enable', async (_req: FastifyRequest, reply: FastifyReply) => {
    updatePathsConfig({ enabled: true });
    
    return reply.send({
      ok: true,
      message: 'Paths engine enabled',
      enabled: true,
    });
  });
  
  /**
   * POST /api/admin/connections/paths/disable
   */
  app.post('/disable', async (_req: FastifyRequest, reply: FastifyReply) => {
    updatePathsConfig({ enabled: false });
    
    return reply.send({
      ok: true,
      message: 'Paths engine disabled',
      enabled: false,
    });
  });
  
  console.log('[Paths Admin] Routes registered: /api/admin/connections/paths/*');
}
