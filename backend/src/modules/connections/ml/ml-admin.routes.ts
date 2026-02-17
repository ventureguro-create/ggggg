/**
 * ML Layer Admin Routes (Phase 5.A)
 * 
 * API endpoints for AQM and Pattern Detection admin control.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { evaluateAlertQuality } from './quality/alert-quality.engine.js';
import { detectPatterns } from './patterns/patterns.engine.js';
import { DEFAULT_AQM_CONFIG, type AQMConfig } from './quality/alert-quality.config.js';
import { DEFAULT_PATTERNS_CONFIG, type PatternsConfig } from './patterns/patterns.config.js';
import type { AlertContext } from './quality/alert-quality.types.js';
import type { PatternInput } from './patterns/patterns.types.js';

// In-memory config (will be persisted to MongoDB in production)
let aqmConfig: AQMConfig = { ...DEFAULT_AQM_CONFIG };
let patternsConfig: PatternsConfig = { ...DEFAULT_PATTERNS_CONFIG };

// In-memory stats (mock)
let aqmStats = {
  distribution: { HIGH: 12, MEDIUM: 8, LOW: 5, NOISE: 3 },
  suppressed_count: 3,
  last_updated: new Date().toISOString(),
};

let patternsStats = {
  counts: { LIKE_FARM: 2, SPIKE_PUMP: 1, OVERLAP_FARM: 0 },
  by_severity: { LOW: 2, MEDIUM: 1, HIGH: 0 },
  recent: [
    { timestamp: new Date().toISOString(), account: 'example1', flags: ['LIKE_FARM'], risk_score: 35, severity: 'LOW' },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), account: 'example2', flags: ['SPIKE_PUMP'], risk_score: 45, severity: 'MEDIUM' },
  ],
  last_updated: new Date().toISOString(),
};

export async function registerMLRoutes(fastify: FastifyInstance): Promise<void> {
  // ============================================================
  // PUBLIC ENDPOINTS
  // ============================================================
  
  /**
   * POST /ml/evaluate-quality
   * Evaluate alert quality using AQM
   */
  fastify.post('/ml/evaluate-quality', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = req.body as AlertContext;
      const result = evaluateAlertQuality(context, aqmConfig);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        message: err.message,
      });
    }
  });
  
  /**
   * POST /ml/evaluate-patterns
   * Detect patterns in input data
   */
  fastify.post('/ml/evaluate-patterns', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = req.body as PatternInput;
      const result = detectPatterns(input, patternsConfig);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        message: err.message,
      });
    }
  });
  
  // ============================================================
  // ADMIN ENDPOINTS - AQM
  // ============================================================
  
  /**
   * GET /admin/ml/config/quality
   * Get AQM configuration
   */
  fastify.get('/admin/ml/config/quality', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: aqmConfig,
    });
  });
  
  /**
   * PATCH /admin/ml/config/quality
   * Update AQM configuration
   */
  fastify.patch('/admin/ml/config/quality', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const updates = req.body as Partial<AQMConfig>;
      
      // Deep merge weights
      if (updates.weights) {
        aqmConfig.weights = { ...aqmConfig.weights, ...updates.weights };
      }
      
      // Deep merge thresholds
      if (updates.thresholds) {
        aqmConfig.thresholds = { ...aqmConfig.thresholds, ...updates.thresholds };
      }
      
      // Merge other fields
      const { weights, thresholds, ...rest } = updates;
      aqmConfig = { ...aqmConfig, ...rest };
      
      console.log('[ML] AQM config updated');
      
      return reply.send({
        ok: true,
        data: aqmConfig,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        message: err.message,
      });
    }
  });
  
  /**
   * GET /admin/ml/stats/quality
   * Get AQM statistics
   */
  fastify.get('/admin/ml/stats/quality', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: aqmStats,
    });
  });
  
  // ============================================================
  // ADMIN ENDPOINTS - PATTERNS
  // ============================================================
  
  /**
   * GET /admin/ml/config/patterns
   * Get Pattern Detection configuration
   */
  fastify.get('/admin/ml/config/patterns', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: patternsConfig,
    });
  });
  
  /**
   * PATCH /admin/ml/config/patterns
   * Update Pattern Detection configuration
   */
  fastify.patch('/admin/ml/config/patterns', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const updates = req.body as Partial<PatternsConfig>;
      
      // Deep merge pattern configs
      if (updates.imbalance) {
        patternsConfig.imbalance = { ...patternsConfig.imbalance, ...updates.imbalance };
      }
      if (updates.spike) {
        patternsConfig.spike = { ...patternsConfig.spike, ...updates.spike };
      }
      if (updates.overlap) {
        patternsConfig.overlap = { ...patternsConfig.overlap, ...updates.overlap };
      }
      if (updates.severity) {
        patternsConfig.severity = { ...patternsConfig.severity, ...updates.severity };
      }
      
      // Merge other fields
      const { imbalance, spike, overlap, severity, ...rest } = updates;
      patternsConfig = { ...patternsConfig, ...rest };
      
      console.log('[ML] Patterns config updated');
      
      return reply.send({
        ok: true,
        data: patternsConfig,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        message: err.message,
      });
    }
  });
  
  /**
   * GET /admin/ml/stats/patterns
   * Get Pattern Detection statistics
   */
  fastify.get('/admin/ml/stats/patterns', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: patternsStats,
    });
  });
  
  // ============================================================
  // ADMIN ENDPOINTS - FEEDBACK (Phase 5.A.3)
  // ============================================================
  
  /**
   * GET /admin/ml/feedback/stats
   * Get feedback statistics
   */
  fastify.get('/admin/ml/feedback/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getFeedbackStore } = await import('./feedback/feedback.store.js');
      const store = getFeedbackStore();
      const stats = await store.getStats();
      
      return reply.send({
        ok: true,
        data: stats,
      });
    } catch (err: any) {
      // Return mock data if store not initialized
      return reply.send({
        ok: true,
        data: {
          total: 0,
          correct: 0,
          false_positive: 0,
          noise: 0,
          too_early: 0,
          unknown: 0,
          fp_rate: 0,
          by_alert_type: {},
          by_pattern: {},
        },
      });
    }
  });
  
  /**
   * GET /admin/ml/feedback/recent
   * Get recent alerts for feedback
   */
  fastify.get('/admin/ml/feedback/recent', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getFeedbackStore } = await import('./feedback/feedback.store.js');
      const store = getFeedbackStore();
      const limit = parseInt((req.query as any).limit) || 50;
      const alerts = await store.getRecentAlerts(limit);
      
      return reply.send({
        ok: true,
        data: { alerts },
      });
    } catch (err: any) {
      return reply.send({
        ok: true,
        data: { alerts: [] },
      });
    }
  });
  
  /**
   * GET /admin/ml/feedback/pending
   * Get alerts needing feedback
   */
  fastify.get('/admin/ml/feedback/pending', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getFeedbackStore } = await import('./feedback/feedback.store.js');
      const store = getFeedbackStore();
      const limit = parseInt((req.query as any).limit) || 20;
      const alerts = await store.getAlertsNeedingFeedback(limit);
      
      return reply.send({
        ok: true,
        data: { alerts },
      });
    } catch (err: any) {
      return reply.send({
        ok: true,
        data: { alerts: [] },
      });
    }
  });
  
  /**
   * POST /admin/ml/feedback/:alertId
   * Add feedback to an alert
   */
  fastify.post('/admin/ml/feedback/:alertId', async (req: FastifyRequest<{ Params: { alertId: string } }>, reply: FastifyReply) => {
    try {
      const { alertId } = req.params;
      const { feedback, note } = req.body as { feedback: string; note?: string };
      
      if (!['CORRECT', 'FALSE_POSITIVE', 'NOISE', 'TOO_EARLY'].includes(feedback)) {
        return reply.status(400).send({
          ok: false,
          message: 'Invalid feedback label. Must be one of: CORRECT, FALSE_POSITIVE, NOISE, TOO_EARLY',
        });
      }
      
      const { getFeedbackStore } = await import('./feedback/feedback.store.js');
      const store = getFeedbackStore();
      const result = await store.addFeedback(alertId, feedback as any, 'ADMIN', 'admin', note);
      
      if (!result) {
        return reply.status(404).send({
          ok: false,
          message: 'Alert not found',
        });
      }
      
      console.log(`[Feedback] Added ${feedback} to alert ${alertId}`);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        message: err.message,
      });
    }
  });
  
  /**
   * GET /admin/ml/feedback/training-data
   * Get labeled feedback for ML training
   */
  fastify.get('/admin/ml/feedback/training-data', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getFeedbackStore } = await import('./feedback/feedback.store.js');
      const store = getFeedbackStore();
      const limit = parseInt((req.query as any).limit) || 1000;
      const data = await store.getTrainingData(limit);
      
      return reply.send({
        ok: true,
        data: {
          count: data.length,
          items: data,
        },
      });
    } catch (err: any) {
      return reply.send({
        ok: true,
        data: { count: 0, items: [] },
      });
    }
  });
  
  console.log('[ML] Admin routes registered');
}
