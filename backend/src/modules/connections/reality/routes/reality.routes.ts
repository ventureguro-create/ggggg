/**
 * Reality Routes - Public API
 * 
 * PHASE E2 + E4: Reality Gate + Leaderboard
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { Db } from 'mongodb';
import { initRealityEvaluator, evaluateReality } from '../services/realityEvaluator.service.js';
import { initWalletCredibility, getWalletCredibility } from '../services/walletCredibility.service.js';
import { initRealityGate, getRealityGateConfig } from '../services/realityGate.service.js';
import { initRealityLedger, getActorLedger, getLedgerByEvent, aggregateActorStats, seedMockLedger } from '../stores/realityLedger.store.js';
import { initRealityLeaderboard, getLeaderboard, getActorReality, getLeaderboardConfig } from '../services/realityLeaderboard.service.js';
import { TAXONOMY_GROUPS } from '../../taxonomy/taxonomy.constants.js';

export function registerRealityRoutes(app: FastifyInstance, db: Db) {
  // Initialize services
  initRealityEvaluator(db);
  initWalletCredibility(db);
  initRealityGate(db);
  initRealityLedger(db);
  initRealityLeaderboard(db);
  
  // NO MOCK DATA - Real data only
  console.log('[Reality] Routes initialized (NO MOCK DATA)');

  // === E2: Reality Gate Public API ===
  
  // GET /api/connections/reality/actor/:actorId - Reality for actor
  app.get('/api/connections/reality/actor/:actorId', async (req: FastifyRequest) => {
    const { actorId } = req.params as { actorId: string };
    const { window = '30' } = req.query as { window?: string };
    const windowDays = parseInt(window);
    
    // Get reality evaluation
    const reality = await evaluateReality(actorId);
    
    // Get wallet credibility
    const credibility = await getWalletCredibility(actorId);
    
    // Get ledger history
    const ledger = await getActorLedger(actorId, windowDays);
    
    // Get stats
    const stats = await aggregateActorStats(actorId, windowDays);
    
    return {
      ok: true,
      actorId,
      windowDays,
      reality,
      credibility,
      stats,
      history: ledger.slice(0, 10), // Last 10 entries
    };
  });
  
  // GET /api/connections/reality/event/:eventId - Reality for event
  app.get('/api/connections/reality/event/:eventId', async (req: FastifyRequest) => {
    const { eventId } = req.params as { eventId: string };
    const entry = await getLedgerByEvent(eventId);
    
    if (!entry) {
      return { ok: false, error: 'Event not found' };
    }
    
    return { ok: true, data: entry };
  });
  
  // GET /api/connections/reality/config - Get config (read-only)
  app.get('/api/connections/reality/config', async () => {
    const config = await getRealityGateConfig();
    return { ok: true, data: config };
  });

  // === E4: Reality Leaderboard API ===
  
  // GET /api/connections/reality/leaderboard - Get leaderboard
  app.get('/api/connections/reality/leaderboard', async (req: FastifyRequest) => {
    const { window = '30', group, limit = '50', sort = 'score' } = req.query as {
      window?: string;
      group?: string;
      limit?: string;
      sort?: 'score' | 'confirms' | 'contradicts' | 'sample';
    };
    
    const entries = await getLeaderboard({
      windowDays: parseInt(window),
      group: group || undefined,
      limit: parseInt(limit),
      sort,
    });
    
    return {
      ok: true,
      windowDays: parseInt(window),
      group: group || null,
      count: entries.length,
      data: entries,
    };
  });
  
  // GET /api/connections/reality/leaderboard/:actorId - Actor reality
  app.get('/api/connections/reality/leaderboard/:actorId', async (req: FastifyRequest) => {
    const { actorId } = req.params as { actorId: string };
    const { window = '30' } = req.query as { window?: string };
    
    const entry = await getActorReality(actorId, parseInt(window));
    
    if (!entry) {
      return { ok: false, error: 'Actor not found in leaderboard' };
    }
    
    return { ok: true, data: entry };
  });
  
  // GET /api/connections/reality/leaderboard/groups - Available groups
  app.get('/api/connections/reality/leaderboard/groups', async () => {
    return {
      ok: true,
      data: TAXONOMY_GROUPS.map(g => ({
        key: g.key,
        title: g.title,
        icon: g.icon,
      })),
    };
  });
  
  // GET /api/connections/reality/leaderboard/explain - Formula explanation
  app.get('/api/connections/reality/leaderboard/explain', async () => {
    const config = await getLeaderboardConfig();
    
    return {
      ok: true,
      formula: {
        description: 'Reality Score = truth_raw * sample_confidence * authority_weight',
        components: {
          truth_raw: `(confirms - ${config.contradict_penalty}*contradicts) / max(1, sample)`,
          coverage: 'sample / total',
          sample_confidence: `1 - exp(-sample / ${config.k_sample})`,
          authority_weight: 'clamp(0.75 + 0.5*authority, 0.75, 1.25)',
          final: '100 * clamp((0.55*truth + 0.45*coverage) * sampleConf * authWeight, -1, 1)',
        },
        levels: {
          ELITE: 'score >= 70',
          STRONG: '45 <= score < 70',
          MIXED: '20 <= score < 45',
          RISKY: 'score < 20',
          INSUFFICIENT: `sample < ${config.min_sample}`,
        },
      },
      config,
    };
  });

  console.log('[Reality] Public routes registered');
}
