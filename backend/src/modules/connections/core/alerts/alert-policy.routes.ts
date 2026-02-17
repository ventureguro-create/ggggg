/**
 * Alert Policy Routes (Phase 4.5.1 + 4.5.2)
 * 
 * Admin API for alert policy configuration, control, and audit.
 * 
 * Endpoints:
 * - GET/PATCH /config - Policy configuration
 * - GET /stats - Quick stats
 * - GET /audit - Full audit log
 * - POST /kill-switch - Emergency stop
 * - POST /test - Test policy (dry run)
 * - POST /test-telegram - Send test message
 * - GET /pending - Get pending alerts
 * - POST /dispatch-pending - Send pending alerts
 * - POST /rollback-mode - Enable/disable rollback mode
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  checkAlertPolicy,
  checkAlertPolicyAsync,
  getAlertPolicyConfig,
  updateAlertPolicyConfig,
  getAlertPolicyAudit,
  getAlertPolicyStats,
  killSwitch,
  testAlertPolicy,
  setRollbackActive,
  loadConfigFromStore,
  type AlertCandidate,
} from './alert-policy.engine.js';
import { sendTestAlert, sendAlertToTelegram } from './telegram-delivery.js';
import { getAlertsEngineConfig } from './connections-alerts-engine.js';
import { getAlertPolicyStore } from './alert-policy.store.js';

export async function registerAlertPolicyRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Load config from MongoDB on startup
  loadConfigFromStore().catch(err => {
    console.warn('[AlertPolicy Routes] Failed to load config:', err);
  });
  
  /**
   * GET /config
   * Get alert policy config
   */
  fastify.get('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = getAlertPolicyConfig();
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * PATCH /config
   * Update alert policy config
   */
  fastify.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const updates = req.body as any;
      const config = await updateAlertPolicyConfig(updates);
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /stats
   * Get alert policy stats (quick, from memory)
   */
  fastify.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = getAlertPolicyStats();
      
      // Also get MongoDB stats if available
      let mongoStats = null;
      try {
        const store = getAlertPolicyStore();
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24h
        mongoStats = await store.getAuditStats(since);
      } catch (err) {
        // Store not available
      }
      
      return reply.send({ 
        ok: true, 
        data: {
          ...stats,
          mongo_stats_24h: mongoStats,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /audit
   * Get alert policy audit log
   */
  fastify.get('/audit', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit, source } = req.query as { limit?: string; source?: string };
      const limitNum = parseInt(limit || '50', 10);
      
      // Quick audit (in-memory)
      const quickAudit = getAlertPolicyAudit(limitNum);
      
      // MongoDB audit if requested
      let mongoAudit = null;
      if (source !== 'memory') {
        try {
          const store = getAlertPolicyStore();
          mongoAudit = await store.getAudit({ limit: limitNum });
        } catch (err) {
          // Store not available
        }
      }
      
      return reply.send({ 
        ok: true, 
        data: {
          quick_audit: quickAudit,
          mongo_audit: mongoAudit,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /kill-switch
   * Disable all alerts immediately
   */
  fastify.post('/kill-switch', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await killSwitch();
      return reply.send({ 
        ok: true, 
        message: 'KILL SWITCH ACTIVATED - All alerts disabled',
        data: getAlertPolicyConfig(),
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /test
   * Test alert policy (dry run)
   */
  fastify.post('/test', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      
      // Create test candidate (use provided or defaults)
      const testCandidate: AlertCandidate = {
        account_id: body?.account_id || 'test_account',
        username: body?.username || 'test_user',
        profile: body?.profile || 'influencer',
        alert_type: body?.alert_type || 'EARLY_BREAKOUT',
        score_from: body?.score_from ?? 612,
        score_to: body?.score_to ?? 742,
        score_delta_pct: body?.score_delta_pct ?? 21,
        confidence_score: body?.confidence_score ?? 82,
        confidence_level: body?.confidence_level || 'HIGH',
        confidence_warnings: body?.confidence_warnings || [],
        hops_to_elite: body?.hops_to_elite ?? 2,
        authority_tier: body?.authority_tier || 'upper_mid',
        graph_divergent_edges_pct: body?.graph_divergent_edges_pct ?? 0,
        graph_min_edge_confidence: body?.graph_min_edge_confidence ?? 75,
        reasons: body?.reasons || ['Strong acceleration', 'Clean audience', '2 hops to elite nodes'],
        severity: body?.severity ?? 0.8,
        live_weight: body?.live_weight ?? 50,
      };
      
      const result = testAlertPolicy(testCandidate);
      
      return reply.send({ 
        ok: true, 
        data: {
          decision: result.decision,
          block_reasons: result.block_reasons,
          checks: result.checks,
          policy_snapshot: result.policy_snapshot,
          would_send: result.decision === 'SEND',
          candidate: testCandidate,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /evaluate
   * Evaluate a candidate with full MongoDB dedup (async)
   */
  fastify.post('/evaluate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const candidate = req.body as AlertCandidate;
      
      if (!candidate?.account_id || !candidate?.alert_type) {
        return reply.status(400).send({ ok: false, error: 'account_id and alert_type required' });
      }
      
      const result = await checkAlertPolicyAsync(candidate);
      
      return reply.send({
        ok: true,
        data: {
          decision: result.decision,
          block_reasons: result.block_reasons,
          alert_id: result.alert_id,
          checks: result.checks,
          policy_snapshot: result.policy_snapshot,
          dedup_hash: result.dedup_hash,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /test-telegram
   * Send test message to Telegram
   */
  fastify.post('/test-telegram', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { chat_id } = req.body as { chat_id?: string };
      
      // Get chat_id from config if not provided
      const targetChatId = chat_id || process.env.TELEGRAM_CHAT_ID;
      
      if (!targetChatId) {
        return reply.status(400).send({ ok: false, error: 'No chat_id provided or configured' });
      }
      
      const result = await sendTestAlert(targetChatId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /send
   * Send a specific alert (admin only)
   */
  fastify.post('/send', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { candidate, chat_id } = req.body as { 
        candidate: AlertCandidate; 
        chat_id?: string;
      };
      
      if (!candidate) {
        return reply.status(400).send({ ok: false, error: 'candidate required' });
      }
      
      // Check policy with MongoDB dedup
      const decision = await checkAlertPolicyAsync(candidate);
      
      if (decision.decision !== 'SEND' || !decision.alert_payload) {
        return reply.send({
          ok: false,
          blocked: true,
          block_reasons: decision.block_reasons,
          checks: decision.checks,
          dedup_hash: decision.dedup_hash,
        });
      }
      
      // Get chat_id
      const targetChatId = chat_id || process.env.TELEGRAM_CHAT_ID;
      
      if (!targetChatId) {
        return reply.status(400).send({ ok: false, error: 'No chat_id' });
      }
      
      // Send to Telegram
      const sendResult = await sendAlertToTelegram(targetChatId, decision.alert_payload);
      
      // Mark as delivered in store
      if (sendResult.ok) {
        try {
          const store = getAlertPolicyStore();
          await store.markDelivered(decision.alert_id!);
        } catch (err) {
          // Non-critical
        }
      }
      
      return reply.send({
        ok: sendResult.ok,
        alert_id: decision.alert_id,
        telegram_result: sendResult,
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /pending
   * Get pending alerts (awaiting dispatch)
   */
  fastify.get('/pending', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getAlertPolicyStore();
      const pending = await store.getPending(100);
      const count = await store.getPendingCount();
      
      return reply.send({
        ok: true,
        data: {
          count,
          alerts: pending,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /dispatch-pending
   * Dispatch all pending alerts
   */
  fastify.post('/dispatch-pending', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { chat_id, limit } = req.body as { chat_id?: string; limit?: number };
      
      const targetChatId = chat_id || process.env.TELEGRAM_CHAT_ID;
      if (!targetChatId) {
        return reply.status(400).send({ ok: false, error: 'No chat_id configured' });
      }
      
      const store = getAlertPolicyStore();
      const pending = await store.getPending(limit || 50);
      
      let sent = 0;
      let failed = 0;
      
      for (const alert of pending) {
        try {
          const result = await sendAlertToTelegram(targetChatId, alert.payload);
          if (result.ok) {
            await store.removePending(alert.alert_id);
            await store.markDelivered(alert.alert_id);
            sent++;
          } else {
            failed++;
          }
        } catch (err) {
          failed++;
        }
      }
      
      return reply.send({
        ok: true,
        data: {
          total_pending: pending.length,
          sent,
          failed,
          remaining: await store.getPendingCount(),
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * DELETE /pending
   * Clear all pending alerts
   */
  fastify.delete('/pending', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getAlertPolicyStore();
      const deleted = await store.clearPending();
      
      return reply.send({
        ok: true,
        data: { deleted },
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /rollback-mode
   * Enable/disable rollback mode (auto-disables alerts)
   */
  fastify.post('/rollback-mode', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { active } = req.body as { active: boolean };
      setRollbackActive(active);
      return reply.send({ 
        ok: true, 
        rollback_active: active,
        message: active ? 'Rollback mode ACTIVE - Alerts disabled' : 'Rollback mode deactivated',
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log('[AlertPolicy] Routes registered at /api/admin/connections/alerts/policy/*');
}
