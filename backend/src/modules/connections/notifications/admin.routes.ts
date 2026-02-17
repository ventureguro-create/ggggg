/**
 * Connections Telegram Admin Routes
 * Phase 2.3: Admin UI endpoints for Telegram delivery
 * 
 * All Telegram control happens HERE - bot has no commands
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TelegramTransport } from './telegram.transport.js';
import { ConnectionsTelegramDispatcher } from './dispatcher.service.js';
import type { TelegramDeliverySettings, ConnectionsAlertType } from './types.js';

interface SettingsPatchBody {
  enabled?: boolean;
  preview_only?: boolean;
  chat_id?: string;
  cooldown_hours?: Partial<Record<ConnectionsAlertType, number>>;
  type_enabled?: Partial<Record<ConnectionsAlertType, boolean>>;
}

interface DispatchBody {
  dryRun?: boolean;
  limit?: number;
}

export function registerConnectionsTelegramAdminRoutes(
  app: FastifyInstance,
  dispatcher: ConnectionsTelegramDispatcher
): void {
  const settingsStore = dispatcher.getSettingsStore();
  const deliveryStore = dispatcher.getDeliveryStore();

  // ============================================================
  // GET /api/admin/connections/telegram/settings
  // Get current Telegram delivery settings
  // ============================================================
  app.get('/api/admin/connections/telegram/settings', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await settingsStore.get();
      return { ok: true, data: settings };
    } catch (err: any) {
      console.error('[TelegramAdmin] Failed to get settings:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // PATCH /api/admin/connections/telegram/settings
  // Update Telegram delivery settings
  // ============================================================
  app.patch('/api/admin/connections/telegram/settings', async (req: FastifyRequest<{ Body: SettingsPatchBody }>, reply: FastifyReply) => {
    try {
      const patch = req.body || {};
      const updated = await settingsStore.patch(patch);
      console.log('[TelegramAdmin] Settings updated:', updated);
      return { ok: true, data: updated };
    } catch (err: any) {
      console.error('[TelegramAdmin] Failed to update settings:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // POST /api/admin/connections/telegram/settings/reset
  // Reset settings to defaults
  // ============================================================
  app.post('/api/admin/connections/telegram/settings/reset', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await settingsStore.reset();
      console.log('[TelegramAdmin] Settings reset to defaults');
      return { ok: true, data: settings };
    } catch (err: any) {
      console.error('[TelegramAdmin] Failed to reset settings:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // POST /api/admin/connections/telegram/test
  // Send test message to configured chat
  // ============================================================
  app.post('/api/admin/connections/telegram/test', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await dispatcher.sendTestMessage();
      return { ok: true, message: result.message };
    } catch (err: any) {
      console.error('[TelegramAdmin] Test message failed:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // POST /api/admin/connections/telegram/dispatch
  // Manually dispatch pending alerts
  // ============================================================
  app.post('/api/admin/connections/telegram/dispatch', async (req: FastifyRequest<{ Body: DispatchBody }>, reply: FastifyReply) => {
    try {
      const { dryRun, limit } = req.body || {};
      const result = await dispatcher.dispatchPending({ dryRun, limit });
      console.log('[TelegramAdmin] Dispatch result:', result);
      return { ok: true, data: result };
    } catch (err: any) {
      console.error('[TelegramAdmin] Dispatch failed:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // GET /api/admin/connections/telegram/history
  // Get delivery history
  // ============================================================
  app.get('/api/admin/connections/telegram/history', async (req: FastifyRequest<{ Querystring: { limit?: string; type?: string; status?: string } }>, reply: FastifyReply) => {
    try {
      const { limit, type, status } = req.query;
      const history = await deliveryStore.getRecent({
        limit: limit ? parseInt(limit) : 50,
        type: type as ConnectionsAlertType | undefined,
        status: status as any,
      });
      return { ok: true, data: history };
    } catch (err: any) {
      console.error('[TelegramAdmin] Failed to get history:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // GET /api/admin/connections/telegram/stats
  // Get delivery statistics
  // ============================================================
  app.get('/api/admin/connections/telegram/stats', async (req: FastifyRequest<{ Querystring: { hours?: string } }>, reply: FastifyReply) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours) : 24;
      const stats = await deliveryStore.getStats(hours);
      return { ok: true, data: stats };
    } catch (err: any) {
      console.error('[TelegramAdmin] Failed to get stats:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  console.log('[TelegramAdmin] Registered Telegram admin routes');
}
