/**
 * AI Summary Admin Routes (Phase 3.5)
 * Admin configuration endpoints
 */

import type { FastifyInstance } from 'fastify';
import { getAiConfig, patchAiConfig, resetAiConfig } from './config.js';
import { AiSummaryService } from './service.js';

let aiService: AiSummaryService | null = null;

export function setAiServiceForAdmin(service: AiSummaryService) {
  aiService = service;
}

export async function registerAiAdminRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /config
   * Get current AI configuration
   */
  app.get('/config', async (_request, reply) => {
    const config = getAiConfig();
    
    return reply.send({
      ok: true,
      data: {
        version: '3.5.0',
        ...config,
      },
    });
  });
  
  /**
   * PATCH /config
   * Update AI configuration
   */
  app.patch('/config', async (request, reply) => {
    const updates = request.body as Partial<ReturnType<typeof getAiConfig>>;
    
    // Validate updates
    const allowedKeys = [
      'enabled',
      'model',
      'max_output_tokens',
      'temperature',
      'min_confidence_to_run',
      'cache_ttl_sec',
      'language',
    ];
    
    const filtered: any = {};
    for (const key of allowedKeys) {
      if (key in updates) {
        filtered[key] = (updates as any)[key];
      }
    }
    
    const updated = patchAiConfig(filtered);
    
    return reply.send({
      ok: true,
      data: {
        version: '3.5.0',
        ...updated,
      },
      message: 'AI config updated',
    });
  });
  
  /**
   * POST /reset
   * Reset AI config to defaults
   */
  app.post('/reset', async (_request, reply) => {
    const config = resetAiConfig();
    
    return reply.send({
      ok: true,
      data: config,
      message: 'AI config reset to defaults',
    });
  });
  
  /**
   * GET /stats
   * Get AI cache statistics
   */
  app.get('/stats', async (_request, reply) => {
    if (!aiService) {
      return reply.status(503).send({ ok: false, error: 'AI service not initialized' });
    }
    
    try {
      const stats = await aiService.getStats();
      
      return reply.send({
        ok: true,
        data: {
          cache: stats,
          config: getAiConfig(),
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message || 'Failed to get stats',
      });
    }
  });
  
  /**
   * POST /test
   * Test AI with sample input
   */
  app.post('/test', async (request, reply) => {
    if (!aiService) {
      return reply.status(503).send({ ok: false, error: 'AI service not initialized' });
    }
    
    // Sample test input
    const testInput = {
      account_id: 'test_account',
      mode: 'summary' as const,
      snapshot: {
        twitter_score_0_1000: 756,
        grade: 'B',
        influence_0_1000: 720,
        quality_0_1: 0.78,
        trend_0_1: 0.65,
        network_0_1: 0.82,
        consistency_0_1: 0.74,
        audience_quality_0_1: 0.81,
        authority_0_1: 0.68,
        smart_followers_0_100: 72,
        hops: {
          avg_hops_to_top: 2.4,
          elite_exposure_share_0_1: 0.35,
          examples: ['2 hops to @whale_alpha', '3 hops to @crypto_guru'],
        },
        trends: {
          velocity_pts_per_day: 12,
          acceleration: 0.15,
          state: 'growing' as const,
        },
        early_signal: {
          score: 68,
          badge: 'rising' as const,
        },
        red_flags: [],
        twitter_confidence_score_0_100: 82,
      },
    };
    
    try {
      const result = await aiService.summarize(testInput);
      
      return reply.send({
        ok: true,
        data: {
          input: testInput,
          output: result,
        },
        message: 'AI test completed',
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message || 'AI test failed',
      });
    }
  });
  
  console.log('[AI Admin Routes] Registered at /api/connections/admin/ai/*');
}
