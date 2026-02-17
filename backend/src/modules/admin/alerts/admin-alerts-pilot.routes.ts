/**
 * Admin Alerts Pilot Routes
 * 
 * Control and monitoring for pilot alerts.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import {
  getPilotConfig,
  updatePilotConfig,
  getPilotAccounts,
  addPilotAccount,
  removePilotAccount,
  getPilotStats,
  initPilotAccountsStore,
} from '../../alerts/pilot/pilot-accounts.store.js';
import {
  getKillSwitchState,
  enableKillSwitch,
  disableKillSwitch,
  isKillSwitchOn,
  initKillSwitchStore,
} from '../../alerts/alerts-kill-switch.store.js';
import {
  getRecentDecisions,
  getSuppressionStats,
  getDecisionCounts,
  initAuditStore,
} from '../../alerts/audit/alert-audit.store.js';
import { initDedupStore, getDedupStats, clearDedup } from '../../alerts/alert-dedup.store.js';
import { getPolicyConfig, updatePolicyConfig } from '../../alerts/alert-policy.engine.js';
import { bridgeSignals } from '../../connections/adapters/twitter/alert-bridge.service.js';
import { evaluateAlert } from '../../alerts/alert-policy.engine.js';
import { logDecision } from '../../alerts/audit/alert-audit.store.js';

let storesInitialized = false;

async function ensureStoresInit() {
  if (!storesInitialized) {
    const db = getMongoDb();
    initPilotAccountsStore(db);
    initKillSwitchStore(db);
    initAuditStore(db);
    initDedupStore(db);
    storesInitialized = true;
  }
}

export async function registerAlertsPilotRoutes(app: FastifyInstance) {
  await ensureStoresInit();

  // GET /status - Full pilot alerts status
  app.get('/status', async () => {
    const pilotStats = await getPilotStats();
    const killSwitch = await getKillSwitchState();
    const dedupStats = await getDedupStats();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const decisionCounts = await getDecisionCounts(today);
    const policyConfig = getPolicyConfig();
    const pilotConfig = getPilotConfig();

    return {
      ok: true,
      data: {
        enabled: pilotConfig.status === 'ACTIVE' && !killSwitch.enabled,
        pilot: { ...pilotStats, config: pilotConfig },
        kill_switch: killSwitch,
        policy: policyConfig,
        dedup: dedupStats,
        today: decisionCounts,
      },
    };
  });

  // GET /recent - Recent alert decisions
  app.get('/recent', async (req: FastifyRequest) => {
    const query = req.query as { limit?: string; decision?: string; source?: string };
    const limit = parseInt(query.limit || '50');
    const filter: any = {};
    if (query.decision) filter.decision = query.decision;
    if (query.source) filter.source = query.source;
    
    const decisions = await getRecentDecisions(limit, filter);
    return { ok: true, data: decisions };
  });

  // GET /suppression-stats - Suppression reasons breakdown
  app.get('/suppression-stats', async () => {
    const stats = await getSuppressionStats();
    return { ok: true, data: stats };
  });

  // POST /enable - Enable pilot alerts
  app.post('/enable', async () => {
    const config = updatePilotConfig({ status: 'ACTIVE' });
    console.log('[AlertsPilot] Enabled');
    return { ok: true, data: config };
  });

  // POST /disable - Disable pilot alerts
  app.post('/disable', async () => {
    const config = updatePilotConfig({ status: 'PAUSED' });
    console.log('[AlertsPilot] Disabled');
    return { ok: true, data: config };
  });

  // POST /kill-switch/on - Emergency stop
  app.post('/kill-switch/on', async (req: FastifyRequest) => {
    const { reason } = req.body as { reason?: string };
    await enableKillSwitch(reason || 'Manual admin action', 'admin', false);
    return { ok: true, message: 'Kill switch enabled - all alerts blocked' };
  });

  // POST /kill-switch/off - Disable kill switch
  app.post('/kill-switch/off', async () => {
    await disableKillSwitch('admin');
    return { ok: true, message: 'Kill switch disabled' };
  });

  // GET /pilot-accounts - List pilot accounts
  app.get('/pilot-accounts', async () => {
    const accounts = await getPilotAccounts();
    return { ok: true, data: accounts };
  });

  // POST /pilot-accounts - Add pilot account
  app.post('/pilot-accounts', async (req: FastifyRequest) => {
    const { account_id, username } = req.body as { account_id: string; username: string };
    await addPilotAccount(account_id, username, 'admin');
    return { ok: true, message: 'Account added to pilot' };
  });

  // DELETE /pilot-accounts/:id - Remove pilot account
  app.delete('/pilot-accounts/:id', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    await removePilotAccount(id);
    return { ok: true, message: 'Account removed from pilot' };
  });

  // POST /test-run - Test alert processing without sending
  app.post('/test-run', async () => {
    const db = getMongoDb();
    const { candidates, skipped } = await bridgeSignals(db);
    const killSwitchOn = await isKillSwitchOn();
    
    const results = [];
    for (const candidate of candidates.slice(0, 10)) {
      const isPilot = true; // For test, assume all are pilot
      const decision = await evaluateAlert(candidate, {
        isPilotAccount: isPilot,
        isDuplicate: false,
        isRateLimited: false,
        isKillSwitchOn: killSwitchOn,
        isAdapterEnabled: true,
        driftLevel: 'LOW',
      });
      
      results.push({
        account: candidate.account_id,
        signal: candidate.signal_type,
        confidence: candidate.confidence,
        decision: decision.decision,
        reason: decision.reason,
        gates: decision.gates_passed,
      });
    }

    return {
      ok: true,
      data: {
        mode: 'TEST_RUN',
        candidates_found: candidates.length,
        skipped,
        sample_results: results,
      },
    };
  });

  // POST /clear-dedup - Clear dedup cache
  app.post('/clear-dedup', async (req: FastifyRequest) => {
    const { account_id } = req.body as { account_id?: string };
    const cleared = await clearDedup(account_id);
    return { ok: true, data: { cleared } };
  });

  // PATCH /policy - Update policy config
  app.patch('/policy', async (req: FastifyRequest) => {
    const updates = req.body as any;
    const config = updatePolicyConfig(updates);
    return { ok: true, data: config };
  });

  // PATCH /pilot-config - Update pilot config
  app.patch('/pilot-config', async (req: FastifyRequest) => {
    const updates = req.body as any;
    const config = updatePilotConfig(updates);
    return { ok: true, data: config };
  });

  console.log('[AlertsPilot] Routes registered at /api/admin/alerts/pilot/*');
}
