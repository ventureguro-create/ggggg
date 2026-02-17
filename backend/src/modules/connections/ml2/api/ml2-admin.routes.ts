/**
 * ML2 Admin API Routes
 * Phase 5.3 — ML2 Shadow Enable
 * 
 * Endpoints for ML2 configuration and monitoring
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMl2Config, updateMl2Config } from '../storage/ml2-config.store.js';
import { getShadowStats, getRecentShadowLogs, getDisagreements } from '../storage/ml2-shadow-log.store.js';

export async function registerMl2AdminRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============================================================
  // CONFIG
  // ============================================================
  
  /**
   * GET /api/admin/connections/ml2/config
   * Get current ML2 configuration
   */
  fastify.get('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getMl2Config();
      return reply.send({
        ok: true,
        data: config,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * PATCH /api/admin/connections/ml2/config
   * Update ML2 configuration
   */
  fastify.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const updates = req.body as any;
      const config = await updateMl2Config(updates);
      
      console.log('[ML2] Config updated via API:', updates);
      
      return reply.send({
        ok: true,
        data: config,
      });
    } catch (err: any) {
      return reply.status(400).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  // ============================================================
  // SHADOW STATS
  // ============================================================
  
  /**
   * GET /api/admin/connections/ml2/shadow/stats
   * Get shadow mode statistics
   */
  fastify.get('/shadow/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const windowDays = parseInt((req.query as any).days) || 7;
      const stats = await getShadowStats(windowDays);
      
      return reply.send({
        ok: true,
        data: stats,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/admin/connections/ml2/shadow/recent
   * Get recent shadow log entries
   */
  fastify.get('/shadow/recent', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const limit = parseInt((req.query as any).limit) || 50;
      const logs = await getRecentShadowLogs(limit);
      
      return reply.send({
        ok: true,
        data: { logs },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/admin/connections/ml2/shadow/disagreements
   * Get entries where ML2 would have changed the decision
   */
  fastify.get('/shadow/disagreements', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const limit = parseInt((req.query as any).limit) || 20;
      const logs = await getDisagreements(limit);
      
      return reply.send({
        ok: true,
        data: { logs },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  // ============================================================
  // PROMOTE / ROLLBACK (Phase C — ML2 ACTIVE_SAFE)
  // ============================================================
  
  /**
   * POST /api/admin/connections/ml2/promote
   * Promote ML2 from SHADOW to ACTIVE_SAFE mode
   * Guards: Must be in SHADOW mode + have enough stats
   */
  fastify.post('/promote', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getMl2Config();
      
      // Guard: Must be in SHADOW mode
      if (config.mode !== 'SHADOW') {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_STATE',
          message: `Cannot promote: current mode is ${config.mode}, must be SHADOW`,
        });
      }
      
      // Guard: Check minimum stats threshold
      const stats = await getShadowStats(7);
      const MIN_EVALUATIONS = 50;
      const MIN_AGREEMENT_RATE = 0.75;
      
      if (stats.total < MIN_EVALUATIONS) {
        return reply.status(400).send({
          ok: false,
          error: 'INSUFFICIENT_DATA',
          message: `Need at least ${MIN_EVALUATIONS} shadow evaluations, have ${stats.total}`,
        });
      }
      
      if (stats.agreement_rate < MIN_AGREEMENT_RATE) {
        return reply.status(400).send({
          ok: false,
          error: 'LOW_AGREEMENT',
          message: `Agreement rate ${(stats.agreement_rate * 100).toFixed(1)}% is below threshold ${MIN_AGREEMENT_RATE * 100}%`,
        });
      }
      
      // Promote to ACTIVE_SAFE
      const updated = await updateMl2Config({ mode: 'ACTIVE_SAFE' });
      
      console.log('[ML2] Promoted to ACTIVE_SAFE mode');
      
      return reply.send({
        ok: true,
        data: updated,
        message: 'ML2 promoted to ACTIVE_SAFE mode',
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * POST /api/admin/connections/ml2/rollback
   * Rollback ML2 from ACTIVE_SAFE to SHADOW mode
   */
  fastify.post('/rollback', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getMl2Config();
      
      // Guard: Must be in ACTIVE_SAFE mode
      if (config.mode !== 'ACTIVE_SAFE') {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_STATE',
          message: `Cannot rollback: current mode is ${config.mode}, must be ACTIVE_SAFE`,
        });
      }
      
      // Rollback to SHADOW
      const updated = await updateMl2Config({ mode: 'SHADOW' });
      
      console.log('[ML2] Rolled back to SHADOW mode');
      
      return reply.send({
        ok: true,
        data: updated,
        message: 'ML2 rolled back to SHADOW mode',
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[ML2] Admin routes registered');
}
