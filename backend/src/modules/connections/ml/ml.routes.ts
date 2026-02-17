/**
 * ML Routes (Phase 5.1 + 5.2)
 * 
 * API for Alert Quality Model and Pattern Detection
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { evaluateAlertQuality } from './quality/alert-quality.engine.js';
import { DEFAULT_AQM_CONFIG, type AQMConfig } from './quality/alert-quality.config.js';
import type { AlertContext } from './quality/alert-quality.types.js';
import { detectPatterns } from './patterns/patterns.engine.js';
import { DEFAULT_PATTERNS_CONFIG, type PatternsConfig } from './patterns/patterns.config.js';
import type { PatternInput } from './patterns/patterns.types.js';

// In-memory config (will sync with MongoDB in production)
let aqmConfig: AQMConfig = { ...DEFAULT_AQM_CONFIG };
let patternsConfig: PatternsConfig = { ...DEFAULT_PATTERNS_CONFIG };

export async function registerMLRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============================================================
  // ALERT QUALITY MODEL (5.1)
  // ============================================================
  
  /**
   * POST /evaluate - Evaluate single alert quality
   */
  fastify.post('/quality/evaluate', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = req.body as AlertContext;
    
    // Also run pattern detection if we have engagement data
    let patternRiskScore: number | undefined;
    if (ctx.scores) {
      const patternInput: PatternInput = {
        likes: ctx.scores.trend * 10 || 0,
        replies: ctx.scores.quality || 0,
        reposts: ctx.scores.network || 0,
        engagement_rate: ctx.early_signal.velocity || 0,
        overlap_pressure: 0,
        audience_purity: ctx.audience.purity_score,
      };
      const patternResult = detectPatterns(patternInput, patternsConfig);
      patternRiskScore = patternResult.risk_score;
    }
    
    const result = evaluateAlertQuality(ctx, aqmConfig, patternRiskScore);
    
    return reply.send({ ok: true, data: result });
  });
  
  /**
   * POST /batch - Evaluate multiple alerts
   */
  fastify.post('/quality/batch', async (req: FastifyRequest, reply: FastifyReply) => {
    const { items } = req.body as { items: AlertContext[] };
    const results = items.map(ctx => evaluateAlertQuality(ctx, aqmConfig));
    return reply.send({ ok: true, data: results });
  });
  
  /**
   * GET /quality/info - Get AQM config info
   */
  fastify.get('/quality/info', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: {
        version: aqmConfig.version,
        enabled: aqmConfig.enabled,
        min_confidence_score: aqmConfig.min_confidence_score,
        thresholds: aqmConfig.thresholds,
        weights: aqmConfig.weights,
        shadow_ml_enabled: aqmConfig.shadow_ml_enabled,
      },
    });
  });
  
  // ============================================================
  // PATTERN DETECTION (5.2)
  // ============================================================
  
  /**
   * POST /patterns/evaluate - Detect patterns in data
   */
  fastify.post('/patterns/evaluate', async (req: FastifyRequest, reply: FastifyReply) => {
    const input = req.body as PatternInput;
    const result = detectPatterns(input, patternsConfig);
    return reply.send({ ok: true, data: result });
  });
  
  /**
   * GET /patterns/info - Get patterns config info
   */
  fastify.get('/patterns/info', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: {
        version: patternsConfig.version,
        enabled: patternsConfig.enabled,
        imbalance: patternsConfig.imbalance,
        spike: patternsConfig.spike,
        overlap: patternsConfig.overlap,
        severity: patternsConfig.severity,
      },
    });
  });
  
  console.log('[ML] Routes registered at /api/connections/ml/*');
}

/**
 * Admin ML Routes
 */
export async function registerAdminMLRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============================================================
  // AQM ADMIN
  // ============================================================
  
  /**
   * GET /quality/config - Get full AQM config
   */
  fastify.get('/quality/config', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ ok: true, data: aqmConfig });
  });
  
  /**
   * PATCH /quality/config - Update AQM config
   */
  fastify.patch('/quality/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const updates = req.body as Partial<AQMConfig>;
    
    // Deep merge
    aqmConfig = {
      ...aqmConfig,
      ...updates,
      weights: { ...aqmConfig.weights, ...(updates.weights || {}) },
      thresholds: { ...aqmConfig.thresholds, ...(updates.thresholds || {}) },
    };
    
    console.log('[ML] AQM config updated:', aqmConfig.enabled, 'v' + aqmConfig.version);
    return reply.send({ ok: true, data: aqmConfig });
  });
  
  /**
   * GET /quality/stats - Get AQM stats (placeholder)
   */
  fastify.get('/quality/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    // In production, this would query MongoDB logs
    return reply.send({
      ok: true,
      data: {
        stats_24h: [
          { label: 'HIGH', count: 15, avg_prob: 0.82 },
          { label: 'MEDIUM', count: 28, avg_prob: 0.63 },
          { label: 'LOW', count: 12, avg_prob: 0.47 },
          { label: 'NOISE', count: 8, avg_prob: 0.25 },
        ],
        total: 63,
        suppressed_pct: 12.7,
      },
    });
  });
  
  // ============================================================
  // PATTERNS ADMIN
  // ============================================================
  
  /**
   * GET /patterns/config - Get full patterns config
   */
  fastify.get('/patterns/config', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ ok: true, data: patternsConfig });
  });
  
  /**
   * PATCH /patterns/config - Update patterns config
   */
  fastify.patch('/patterns/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const updates = req.body as Partial<PatternsConfig>;
    
    // Deep merge
    patternsConfig = {
      ...patternsConfig,
      ...updates,
      imbalance: { ...patternsConfig.imbalance, ...(updates.imbalance || {}) },
      spike: { ...patternsConfig.spike, ...(updates.spike || {}) },
      overlap: { ...patternsConfig.overlap, ...(updates.overlap || {}) },
      severity: { ...patternsConfig.severity, ...(updates.severity || {}) },
    };
    
    console.log('[ML] Patterns config updated:', patternsConfig.enabled, 'v' + patternsConfig.version);
    return reply.send({ ok: true, data: patternsConfig });
  });
  
  /**
   * GET /patterns/stats - Get patterns stats (placeholder)
   */
  fastify.get('/patterns/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: {
        stats_24h: [
          { flag: 'LIKE_FARM', count: 3 },
          { flag: 'SPIKE_PUMP', count: 5 },
          { flag: 'OVERLAP_FARM', count: 2 },
        ],
        total_flagged: 10,
        high_severity: 2,
        medium_severity: 5,
        low_severity: 3,
      },
    });
  });
  
  /**
   * POST /test - Test both AQM and Patterns
   */
  fastify.post('/test', async (req: FastifyRequest, reply: FastifyReply) => {
    const { alert_context, pattern_input } = req.body as {
      alert_context?: AlertContext;
      pattern_input?: PatternInput;
    };
    
    let aqmResult = null;
    let patternResult = null;
    
    if (alert_context) {
      aqmResult = evaluateAlertQuality(alert_context, aqmConfig);
    }
    
    if (pattern_input) {
      patternResult = detectPatterns(pattern_input, patternsConfig);
    }
    
    return reply.send({
      ok: true,
      data: {
        aqm: aqmResult,
        patterns: patternResult,
      },
    });
  });
  
  console.log('[ML] Admin routes registered at /api/admin/connections/ml/*');
}

// Export configs for use in other modules
export function getAQMConfig(): AQMConfig { return aqmConfig; }
export function getPatternsConfig(): PatternsConfig { return patternsConfig; }
