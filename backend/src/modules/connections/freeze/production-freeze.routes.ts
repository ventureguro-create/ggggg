/**
 * Production Freeze v1 - Routes
 * 
 * Admin API for Production Freeze management
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getProductionFreezeConfig,
  activateProductionFreeze,
  lockProductionFreeze,
  isProductionFreezeActive,
  recordFalsePositive,
  recordFalseNegative,
  recordUsefulSignal,
  getFeedbackStats,
  setNetworkV2Status,
} from './production-freeze.store.js';
import { isMicroFreezeActive } from './micro-freeze.store.js';

export function registerProductionFreezeRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/production-freeze';
  
  // ============================================================
  // GET /status - Full Production Freeze status
  // ============================================================
  app.get(`${PREFIX}/status`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getProductionFreezeConfig();
      const microFreezeActive = await isMicroFreezeActive();
      const feedbackStats = await getFeedbackStats();
      
      return reply.send({
        ok: true,
        data: {
          version: config.version,
          status: config.status,
          level: config.level,
          activated_at: config.activated_at,
          activated_by: config.activated_by,
          
          // Prerequisites
          prerequisites: {
            micro_freeze_active: microFreezeActive,
            t26_complete: true, // Assumed from earlier activation
          },
          
          // Frozen components summary
          frozen_components: Object.entries(config.frozen_components).map(([key, comp]) => ({
            id: key,
            name: comp.name,
            version: comp.version,
            frozen_at: comp.frozen_at,
            locked_params: comp.locked_params,
          })),
          
          // What you CAN do
          allowed_actions: config.allowed_actions,
          
          // What you CANNOT do
          blocked_actions: config.blocked_actions,
          
          // Statistics
          stats: {
            ...config.stats_collection,
            ...feedbackStats,
          },
          
          // Network v2
          network_v2: {
            ready: config.network_v2_ready,
            status: config.network_v2_status,
          },
          
          // Badge for UI
          badge: config.status === 'LOCKED' 
            ? '🔒 PRODUCTION FREEZE LOCKED' 
            : config.status === 'ACTIVE' 
              ? '🧊 PRODUCTION FREEZE v1' 
              : '⚪ NOT FROZEN',
        },
      });
    } catch (err: any) {
      console.error('[ProductionFreeze] Status error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /activate - Activate Production Freeze v1
  // ============================================================
  app.post(`${PREFIX}/activate`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check prerequisites
      const microFreezeActive = await isMicroFreezeActive();
      
      if (!microFreezeActive) {
        return reply.code(400).send({
          ok: false,
          error: 'PREREQUISITE_FAILED',
          message: 'Micro-Freeze (T2.5) must be ACTIVE before Production Freeze',
          action: 'POST /api/admin/connections/freeze/activate',
        });
      }
      
      const body = request.body as { activated_by?: string } | undefined;
      const config = await activateProductionFreeze(body?.activated_by || 'ADMIN');
      
      return reply.send({
        ok: true,
        message: '🧊 PRODUCTION FREEZE v1 ACTIVATED',
        warning: 'All core components are now FROZEN. No modifications allowed.',
        data: {
          status: config.status,
          activated_at: config.activated_at,
          activated_by: config.activated_by,
          frozen_components: Object.keys(config.frozen_components).length,
          what_you_can_do: [
            '✅ Add real accounts',
            '✅ Enable alerts',
            '✅ Collect feedback (FP/FN)',
            '✅ Monitor statistics',
            '✅ Update UI/UX',
          ],
          what_you_cannot_do: [
            '❌ Change weights or formulas',
            '❌ Modify decision logic',
            '❌ Tune for market conditions',
            '❌ Add new signal types',
          ],
        },
      });
    } catch (err: any) {
      console.error('[ProductionFreeze] Activate error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /lock - Permanently lock (no going back)
  // ============================================================
  app.post(`${PREFIX}/lock`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isActive = await isProductionFreezeActive();
      
      if (!isActive) {
        return reply.code(400).send({
          ok: false,
          error: 'NOT_ACTIVE',
          message: 'Production Freeze must be ACTIVE before locking',
        });
      }
      
      const body = request.body as { confirm?: boolean } | undefined;
      
      if (!body?.confirm) {
        return reply.code(400).send({
          ok: false,
          error: 'CONFIRMATION_REQUIRED',
          message: 'Set confirm: true to permanently lock Production Freeze',
          warning: '⚠️ This action cannot be undone',
        });
      }
      
      const config = await lockProductionFreeze();
      
      return reply.send({
        ok: true,
        message: '🔒 PRODUCTION FREEZE PERMANENTLY LOCKED',
        data: {
          status: config.status,
          locked_at: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('[ProductionFreeze] Lock error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /feedback/fp - Record False Positive
  // ============================================================
  app.post(`${PREFIX}/feedback/fp`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { alert_id: string; notes?: string };
      
      if (!body.alert_id) {
        return reply.code(400).send({ ok: false, error: 'alert_id required' });
      }
      
      await recordFalsePositive(body.alert_id, body.notes);
      
      return reply.send({
        ok: true,
        message: 'False Positive recorded',
        data: { alert_id: body.alert_id },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /feedback/fn - Record False Negative
  // ============================================================
  app.post(`${PREFIX}/feedback/fn`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { description: string; notes?: string };
      
      if (!body.description) {
        return reply.code(400).send({ ok: false, error: 'description required' });
      }
      
      await recordFalseNegative(body.description, body.notes);
      
      return reply.send({
        ok: true,
        message: 'False Negative recorded',
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /feedback/useful - Record Useful Signal
  // ============================================================
  app.post(`${PREFIX}/feedback/useful`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { alert_id: string; notes?: string };
      
      if (!body.alert_id) {
        return reply.code(400).send({ ok: false, error: 'alert_id required' });
      }
      
      await recordUsefulSignal(body.alert_id, body.notes);
      
      return reply.send({
        ok: true,
        message: 'Useful signal recorded',
        data: { alert_id: body.alert_id },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /feedback/stats - Get feedback statistics
  // ============================================================
  app.get(`${PREFIX}/feedback/stats`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getProductionFreezeConfig();
      const stats = await getFeedbackStats();
      
      return reply.send({
        ok: true,
        data: {
          collection_started: config.stats_collection.started_at,
          total_alerts: config.stats_collection.total_alerts,
          feedback: {
            false_positives: config.stats_collection.fp_count,
            false_negatives: config.stats_collection.fn_count,
            useful_signals: config.stats_collection.useful_signals,
            total_feedback: stats.total_feedback,
          },
          rates: {
            fp_rate: `${(stats.fp_rate * 100).toFixed(1)}%`,
            useful_rate: `${(stats.useful_rate * 100).toFixed(1)}%`,
          },
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /network-v2/prepare - Start Network v2 preparation
  // ============================================================
  app.post(`${PREFIX}/network-v2/prepare`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await setNetworkV2Status('PREPARING');
      
      return reply.send({
        ok: true,
        message: 'Network v2 preparation started',
        data: {
          status: config.network_v2_status,
          next_step: 'Build Follow-Graph Reader',
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[ProductionFreeze] Routes registered at ${PREFIX}/*`);
}
