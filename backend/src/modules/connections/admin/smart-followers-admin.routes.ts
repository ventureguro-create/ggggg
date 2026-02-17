/**
 * Smart Followers Admin Routes
 * 
 * Prefix: /api/admin/connections/smart-followers
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  smartFollowersConfig, 
  updateSmartFollowersConfig, 
  getSmartFollowersConfig,
  SmartFollowersConfig,
} from '../core/smart-followers/index.js';

export async function registerSmartFollowersAdminRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/admin/connections/smart-followers/config
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: getSmartFollowersConfig(),
    });
  });
  
  /**
   * PATCH /api/admin/connections/smart-followers/config
   */
  app.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Partial<SmartFollowersConfig>;
    
    // Validate tier multipliers
    if (body.tier_multiplier) {
      for (const [tier, mult] of Object.entries(body.tier_multiplier)) {
        if (mult < 0 || mult > 3) {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_MULTIPLIER',
            message: `Tier multiplier for ${tier} must be between 0 and 3`,
          });
        }
      }
    }
    
    // Validate integration mix
    if (body.integration?.quality_mix) {
      const mix = body.integration.quality_mix;
      const sum = (mix.engagement || 0) + (mix.consistency || 0) + (mix.smart_followers || 0);
      if (Math.abs(sum - 1) > 0.01) {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_MIX',
          message: 'Quality mix weights must sum to 1.0',
        });
      }
    }
    
    const updated = updateSmartFollowersConfig(body);
    
    return reply.send({
      ok: true,
      message: 'Smart Followers config updated',
      data: updated,
    });
  });
  
  /**
   * POST /api/admin/connections/smart-followers/reset
   * Reset to default configuration
   */
  app.post('/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    const defaults: Partial<SmartFollowersConfig> = {
      tier_multiplier: {
        elite: 1.5,
        high: 1.25,
        upper_mid: 1.1,
        mid: 1.0,
        low_mid: 0.85,
        low: 0.75,
      },
      top_n: 10,
      normalize: {
        method: 'logistic',
        logistic: { k: 0.35, clamp: true },
        minmax: { min_weight: 0, max_weight: 40, clamp: true },
      },
      integration: {
        quality_mix: {
          engagement: 0.50,
          consistency: 0.30,
          smart_followers: 0.20,
        },
      },
      thresholds: {
        elite_share_high: 0.55,
        elite_share_low: 0.10,
        top_concentration_high: 0.70,
        small_followers_n: 200,
      },
      enabled: true,
    };
    
    const updated = updateSmartFollowersConfig(defaults);
    
    return reply.send({
      ok: true,
      message: 'Smart Followers config reset to defaults',
      data: updated,
    });
  });
  
  /**
   * POST /api/admin/connections/smart-followers/enable
   */
  app.post('/enable', async (_req: FastifyRequest, reply: FastifyReply) => {
    updateSmartFollowersConfig({ enabled: true });
    
    return reply.send({
      ok: true,
      message: 'Smart Followers engine enabled',
      enabled: true,
    });
  });
  
  /**
   * POST /api/admin/connections/smart-followers/disable
   */
  app.post('/disable', async (_req: FastifyRequest, reply: FastifyReply) => {
    updateSmartFollowersConfig({ enabled: false });
    
    return reply.send({
      ok: true,
      message: 'Smart Followers engine disabled',
      enabled: false,
    });
  });
  
  console.log('[SmartFollowers Admin] Routes registered: /api/admin/connections/smart-followers/*');
}
