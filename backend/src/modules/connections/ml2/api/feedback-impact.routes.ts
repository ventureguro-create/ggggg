/**
 * Feedback & Impact API Routes - PHASE C2
 * 
 * POST /api/admin/connections/feedback - Submit feedback
 * GET  /api/admin/connections/feedback/stats - Get feedback statistics
 * GET  /api/admin/connections/feedback/recent - Get recent feedback
 * GET  /api/admin/connections/ml2/impact - Get ML2 impact metrics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { saveFeedback, getFeedbackStats, getRecentFeedback } from '../feedback/index.js';
import { getImpactMetrics, getRealityStats } from '../impact/index.js';
import type { FeedbackInput } from '../feedback/feedback.types.js';

export async function registerFeedbackRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============================================================
  // FEEDBACK ENDPOINTS
  // ============================================================
  
  /**
   * POST /api/admin/connections/feedback
   * Submit feedback for an alert/actor decision
   */
  fastify.post('/feedback', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as FeedbackInput;
      
      // Validation
      if (!body.actorId || !body.action || !body.source || !body.ml2Decision) {
        return reply.status(400).send({
          ok: false,
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: actorId, action, source, ml2Decision',
        });
      }
      
      const validActions = ['FALSE_POSITIVE', 'CORRECT', 'IGNORE', 'SAVE', 'CLICK'];
      if (!validActions.includes(body.action)) {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_ACTION',
          message: `Action must be one of: ${validActions.join(', ')}`,
        });
      }
      
      const validSources = ['ADMIN', 'USER', 'SYSTEM'];
      if (!validSources.includes(body.source)) {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_SOURCE',
          message: `Source must be one of: ${validSources.join(', ')}`,
        });
      }
      
      const result = await saveFeedback(body);
      
      return reply.send({
        ok: true,
        message: 'Feedback recorded',
        data: result,
      });
    } catch (err: any) {
      console.error('[Feedback] Error saving:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/admin/connections/feedback/stats
   * Get aggregated feedback statistics
   */
  fastify.get('/feedback/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as { window?: string };
      const windowDays = query.window === '30d' ? 30 : query.window === '90d' ? 90 : 7;
      
      const stats = await getFeedbackStats(windowDays);
      
      return reply.send({
        ok: true,
        data: {
          window: `${windowDays}d`,
          ...stats,
        },
      });
    } catch (err: any) {
      console.error('[Feedback] Error getting stats:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/admin/connections/feedback/recent
   * Get recent feedback entries
   */
  fastify.get('/feedback/recent', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as { limit?: string };
      const limit = parseInt(query.limit || '50');
      
      const entries = await getRecentFeedback(Math.min(limit, 100));
      
      return reply.send({
        ok: true,
        data: {
          entries,
          count: entries.length,
        },
      });
    } catch (err: any) {
      console.error('[Feedback] Error getting recent:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[ML2/Feedback] Routes registered');
}

export async function registerImpactRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============================================================
  // IMPACT ENDPOINTS
  // ============================================================
  
  /**
   * GET /api/admin/connections/ml2/impact
   * Get ML2 impact metrics
   */
  fastify.get('/impact', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as { window?: string };
      const window = ['7d', '30d', '90d'].includes(query.window || '') 
        ? query.window! 
        : '7d';
      
      const metrics = await getImpactMetrics(window);
      
      // Add impact score interpretation
      let impactLevel: string | null = null;
      if (metrics.impactScore !== null) {
        if (metrics.impactScore >= 0.75) impactLevel = 'STRONG';
        else if (metrics.impactScore >= 0.5) impactLevel = 'GOOD';
        else if (metrics.impactScore >= 0.3) impactLevel = 'MODERATE';
        else impactLevel = 'WEAK';
      }
      
      return reply.send({
        ok: true,
        data: {
          ...metrics,
          impactLevel,
        },
      });
    } catch (err: any) {
      console.error('[Impact] Error getting metrics:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/admin/connections/ml2/impact/reality
   * Get reality stats (CONFIRMS vs CONTRADICTS)
   */
  fastify.get('/impact/reality', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as { days?: string };
      const days = parseInt(query.days || '7');
      
      const stats = await getRealityStats(Math.min(days, 90));
      
      return reply.send({
        ok: true,
        data: stats,
      });
    } catch (err: any) {
      console.error('[Impact] Error getting reality stats:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[ML2/Impact] Routes registered');
}

console.log('[ML2/FeedbackImpact] Routes module loaded (Phase C2)');
