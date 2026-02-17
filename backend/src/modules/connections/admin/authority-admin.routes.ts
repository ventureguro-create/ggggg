/**
 * Authority Admin Routes
 * 
 * Prefix: /api/admin/connections/authority
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  authorityConfig, 
  updateAuthorityConfig, 
  getAuthorityConfig,
  AuthorityConfig,
} from '../core/authority/index.js';

export async function registerAuthorityAdminRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/admin/connections/authority/config
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: getAuthorityConfig(),
    });
  });
  
  /**
   * PATCH /api/admin/connections/authority/config
   */
  app.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Partial<AuthorityConfig>;
    
    // Validate numeric ranges
    if (body.damping !== undefined && (body.damping < 0 || body.damping > 1)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_DAMPING',
        message: 'Damping must be between 0 and 1',
      });
    }
    
    if (body.iterations !== undefined && (body.iterations < 1 || body.iterations > 100)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_ITERATIONS',
        message: 'Iterations must be between 1 and 100',
      });
    }
    
    if (body.min_edge_strength !== undefined && (body.min_edge_strength < 0 || body.min_edge_strength > 1)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_MIN_EDGE_STRENGTH',
        message: 'min_edge_strength must be between 0 and 1',
      });
    }
    
    // Validate network mix weights
    if (body.twitter_score_network_mix) {
      const mix = body.twitter_score_network_mix;
      const sum = (mix.audience_quality || 0) + (mix.authority_proximity || 0) + (mix.authority_score || 0);
      
      if (Math.abs(sum - 1) > 0.01) {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_NETWORK_MIX',
          message: 'Network mix weights must sum to 1.0',
        });
      }
    }
    
    const updated = updateAuthorityConfig(body);
    
    return reply.send({
      ok: true,
      message: 'Authority config updated',
      data: updated,
    });
  });
  
  /**
   * POST /api/admin/connections/authority/reset
   * Reset to default configuration
   */
  app.post('/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    const defaults: Partial<AuthorityConfig> = {
      damping: 0.85,
      iterations: 20,
      tolerance: 1e-6,
      min_edge_strength: 0.15,
      use_undirected_proxy: true,
      normalize: {
        method: 'minmax',
        clamp: true,
      },
      twitter_score_network_mix: {
        audience_quality: 0.45,
        authority_proximity: 0.30,
        authority_score: 0.25,
      },
      enabled: true,
    };
    
    const updated = updateAuthorityConfig(defaults);
    
    return reply.send({
      ok: true,
      message: 'Authority config reset to defaults',
      data: updated,
    });
  });
  
  /**
   * POST /api/admin/connections/authority/enable
   */
  app.post('/enable', async (_req: FastifyRequest, reply: FastifyReply) => {
    updateAuthorityConfig({ enabled: true });
    
    return reply.send({
      ok: true,
      message: 'Authority engine enabled',
      enabled: true,
    });
  });
  
  /**
   * POST /api/admin/connections/authority/disable
   */
  app.post('/disable', async (_req: FastifyRequest, reply: FastifyReply) => {
    updateAuthorityConfig({ enabled: false });
    
    return reply.send({
      ok: true,
      message: 'Authority engine disabled',
      enabled: false,
    });
  });
  
  console.log('[Authority Admin] Routes registered: /api/admin/connections/authority/*');
}
