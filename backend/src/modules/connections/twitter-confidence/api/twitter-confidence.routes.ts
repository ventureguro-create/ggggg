/**
 * Twitter Confidence Score API Routes
 * 
 * Public and Admin endpoints for confidence scoring.
 * 
 * PHASE 4.1.6 — Twitter Confidence Score v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TwitterConfidenceInput, TwitterConfidenceStats } from '../contracts/index.js';
import {
  getConfidenceConfig,
  updateConfidenceConfig,
  resetConfidenceConfig,
  computeTwitterConfidence,
  computeDampening,
  shouldBlockAlerts,
  shouldWarnInAlerts,
  explainConfidence,
  formatConfidenceForAlert,
} from '../core/index.js';

// Stats tracking
const confidenceStats = {
  total_computations: 0,
  by_label: { HIGH: 0, MEDIUM: 0, LOW: 0, CRITICAL: 0 } as Record<string, number>,
  total_score_sum: 0,
  warnings_count: 0,
  blocked_alerts_count: 0,
  last_reset: new Date(),
};

/**
 * Register public confidence routes
 * Prefix: /api/connections/twitter-confidence
 */
export async function registerTwitterConfidenceRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * POST /compute
   * Compute confidence score for given input
   */
  app.post('/compute', async (req: FastifyRequest, reply: FastifyReply) => {
    const input = req.body as TwitterConfidenceInput;
    
    try {
      const result = computeTwitterConfidence(input);
      const dampening = computeDampening(result);
      const alertPolicy = shouldBlockAlerts(result);
      const explain = explainConfidence(result);
      
      // Update stats
      confidenceStats.total_computations++;
      confidenceStats.by_label[result.label]++;
      confidenceStats.total_score_sum += result.score_0_1;
      confidenceStats.warnings_count += result.warnings.length;
      if (alertPolicy.block) confidenceStats.blocked_alerts_count++;
      
      return reply.send({
        ok: true,
        data: {
          confidence: result,
          dampening,
          alert_policy: {
            blocked: alertPolicy.block,
            block_reason: alertPolicy.reason,
            warn_in_alert: shouldWarnInAlerts(result),
          },
          explain,
        },
      });
    } catch (err: any) {
      return reply.status(400).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /mock
   * Get a mock confidence result for testing
   */
  app.get('/mock', async (_req: FastifyRequest, reply: FastifyReply) => {
    const mockInput: TwitterConfidenceInput = {
      author_id: 'mock_account',
      data_age_hours: 2,
      has_profile_meta: true,
      has_engagement: true,
      has_follow_graph: true,
      source_type: 'mock',
    };
    
    const result = computeTwitterConfidence(mockInput);
    const explain = explainConfidence(result);
    
    return reply.send({
      ok: true,
      data: {
        confidence: result,
        explain,
        note: 'This is a mock result for testing/demo purposes',
      },
    });
  });
  
  /**
   * POST /preview-dampening
   * Preview how dampening would affect a value
   */
  app.post('/preview-dampening', async (req: FastifyRequest, reply: FastifyReply) => {
    const { raw_value, confidence_input } = req.body as {
      raw_value: number;
      confidence_input: TwitterConfidenceInput;
    };
    
    const result = computeTwitterConfidence(confidence_input);
    const dampening = computeDampening(result);
    const damped_value = raw_value * dampening.multiplier;
    
    return reply.send({
      ok: true,
      data: {
        raw_value,
        damped_value: Math.round(damped_value * 100) / 100,
        multiplier: dampening.multiplier,
        confidence_label: result.label,
        confidence_score: result.score_0_1,
      },
    });
  });
  
  console.log('[TwitterConfidence] Public routes registered: /api/connections/twitter-confidence/*');
}

/**
 * Register admin confidence routes
 * Prefix: /api/admin/connections/twitter-confidence
 */
export async function registerTwitterConfidenceAdminRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /config
   * Get current configuration
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: getConfidenceConfig(),
    });
  });
  
  /**
   * PATCH /config
   * Update configuration
   */
  app.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const updates = req.body as any;
    
    try {
      const newConfig = updateConfidenceConfig(updates);
      return reply.send({
        ok: true,
        message: 'Configuration updated',
        data: newConfig,
      });
    } catch (err: any) {
      return reply.status(400).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * POST /config/reset
   * Reset to default configuration
   */
  app.post('/config/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = resetConfidenceConfig();
    return reply.send({
      ok: true,
      message: 'Configuration reset to defaults',
      data: config,
    });
  });
  
  /**
   * GET /stats
   * Get aggregated statistics
   */
  app.get('/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    const stats: TwitterConfidenceStats = {
      period: '24h',
      total_computations: confidenceStats.total_computations,
      by_label: confidenceStats.by_label as any,
      avg_score: confidenceStats.total_computations > 0
        ? Math.round((confidenceStats.total_score_sum / confidenceStats.total_computations) * 100) / 100
        : 0,
      warnings_count: confidenceStats.warnings_count,
      blocked_alerts_count: confidenceStats.blocked_alerts_count,
    };
    
    return reply.send({
      ok: true,
      data: stats,
    });
  });
  
  /**
   * POST /stats/reset
   * Reset statistics
   */
  app.post('/stats/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    confidenceStats.total_computations = 0;
    confidenceStats.by_label = { HIGH: 0, MEDIUM: 0, LOW: 0, CRITICAL: 0 };
    confidenceStats.total_score_sum = 0;
    confidenceStats.warnings_count = 0;
    confidenceStats.blocked_alerts_count = 0;
    confidenceStats.last_reset = new Date();
    
    return reply.send({
      ok: true,
      message: 'Statistics reset',
    });
  });
  
  /**
   * POST /test-policy
   * Test alert policy for given confidence score
   */
  app.post('/test-policy', async (req: FastifyRequest, reply: FastifyReply) => {
    const { score_0_1 } = req.body as { score_0_1: number };
    const config = getConfidenceConfig();
    
    const blocked = score_0_1 < config.policy.block_alerts_below;
    const warned = score_0_1 < config.policy.warn_in_alerts_below;
    
    return reply.send({
      ok: true,
      data: {
        score_0_1,
        alerts_blocked: blocked,
        alerts_warned: warned,
        thresholds: {
          block_below: config.policy.block_alerts_below,
          warn_below: config.policy.warn_in_alerts_below,
        },
      },
    });
  });
  
  console.log('[TwitterConfidence Admin] Routes registered: /api/admin/connections/twitter-confidence/*');
}
