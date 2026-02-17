/**
 * Reality Gate Admin Routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RealityGateService } from '../services/reality-gate.service.js';
import { RealityGateConfigStore } from '../services/reality-gate-config.store.js';
import { RealityGateAuditStore } from '../services/reality-gate-audit.store.js';
import { TwitterEventInput } from '../contracts/reality-gate.types.js';

const TestEventSchema = z.object({
  eventId: z.string(),
  actorId: z.string(),
  asset: z.string().optional(),
  twitterScore_0_1000: z.number().optional(),
  networkScore_0_1: z.number().optional(),
  eventType: z.enum(['BREAKOUT', 'EARLY_SIGNAL', 'SMART_NO_NAME', 'VC_MENTION', 'WHALE_ALERT', 'GENERIC']),
  occurredAt: z.string(),
  meta: z.object({
    tweetId: z.string().optional(),
    handle: z.string().optional(),
  }).optional(),
});

const ConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  requireConfirmFor: z.array(z.enum(['BREAKOUT', 'EARLY_SIGNAL', 'SMART_NO_NAME', 'VC_MENTION', 'WHALE_ALERT', 'GENERIC'])).optional(),
  thresholds: z.object({
    blockBelow_0_1: z.number().min(0).max(1).optional(),
    downgradeBelow_0_1: z.number().min(0).max(1).optional(),
    boostAbove_0_1: z.number().min(0).max(1).optional(),
  }).optional(),
  trustMultipliers: z.object({
    onConfirmed: z.number().min(0.5).max(2).optional(),
    onContradicted: z.number().min(0.1).max(1).optional(),
    onNoData: z.number().min(0.5).max(1.5).optional(),
  }).optional(),
  noDataBehavior: z.enum(['SEND_LOW', 'SUPPRESS', 'SEND']).optional(),
  bypassForHighAuthority: z.boolean().optional(),
});

export async function registerRealityGateAdminRoutes(
  app: FastifyInstance,
  deps: {
    gate: RealityGateService;
    configStore: RealityGateConfigStore;
    auditStore: RealityGateAuditStore;
  }
) {
  // Get status
  app.get('/status', async () => {
    const status = await deps.gate.getStatus();
    return { ok: true, data: status };
  });

  // Get config
  app.get('/config', async () => {
    const config = await deps.configStore.getOrCreate();
    return { ok: true, data: config };
  });

  // Update config
  app.patch('/config', async (req) => {
    const body = ConfigPatchSchema.parse((req as any).body ?? {});
    const config = await deps.configStore.patch(body as any);
    return { ok: true, data: config };
  });

  // Test evaluate
  app.post('/test', async (req) => {
    const body = TestEventSchema.parse((req as any).body ?? {});
    const result = await deps.gate.evaluate(body as TwitterEventInput);
    
    // Record in audit
    await deps.auditStore.record(result);
    
    return { ok: true, data: result };
  });

  // Get audit stats
  app.get('/audit/stats', async () => {
    const stats = await deps.auditStore.getStats();
    return { ok: true, data: stats };
  });

  // Get audit by actor
  app.get('/audit/actor/:actorId', async (req) => {
    const { actorId } = (req as any).params;
    const limit = Number((req as any).query.limit || 50);
    const entries = await deps.auditStore.listByActor(actorId, limit);
    return { ok: true, data: entries };
  });

  // Get blocked alerts
  app.get('/audit/blocked', async (req) => {
    const limit = Number((req as any).query.limit || 50);
    const entries = await deps.auditStore.listByDecision('BLOCK', limit);
    return { ok: true, data: entries };
  });

  // Kill switch - disable gate
  app.post('/kill-switch', async () => {
    await deps.configStore.patch({ enabled: false });
    return { ok: true, message: 'Reality Gate DISABLED' };
  });

  // Enable gate
  app.post('/enable', async () => {
    await deps.configStore.patch({ enabled: true });
    return { ok: true, message: 'Reality Gate ENABLED' };
  });

  console.log('[RealityGate] Admin routes registered');
}
