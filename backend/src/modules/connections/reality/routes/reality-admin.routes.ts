/**
 * Reality Admin Routes
 * 
 * PHASE E2 + E4: Admin API for Reality Gate + Leaderboard
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { Db } from 'mongodb';
import { getRealityGateConfig, updateRealityGateConfig } from '../services/realityGate.service.js';
import { getLeaderboardConfig, updateLeaderboardConfig, getLeaderboard } from '../services/realityLeaderboard.service.js';
import { getGlobalStats, seedMockLedger } from '../stores/realityLedger.store.js';

export function registerRealityAdminRoutes(app: FastifyInstance, db: Db) {

  // === E2: Reality Gate Admin ===
  
  // GET /api/admin/connections/reality/config
  app.get('/api/admin/connections/reality/config', async () => {
    const gateConfig = await getRealityGateConfig();
    const leaderboardConfig = await getLeaderboardConfig();
    
    return {
      ok: true,
      data: {
        gate: gateConfig,
        leaderboard: leaderboardConfig,
      },
    };
  });
  
  // PATCH /api/admin/connections/reality/config
  app.patch('/api/admin/connections/reality/config', async (req: FastifyRequest) => {
    const { gate, leaderboard } = (req.body ?? {}) as {
      gate?: any;
      leaderboard?: any;
    };
    
    let updatedGate, updatedLeaderboard;
    
    if (gate) {
      updatedGate = await updateRealityGateConfig(gate);
    }
    
    if (leaderboard) {
      updatedLeaderboard = await updateLeaderboardConfig(leaderboard);
    }
    
    return {
      ok: true,
      data: {
        gate: updatedGate,
        leaderboard: updatedLeaderboard,
      },
    };
  });
  
  // GET /api/admin/connections/reality/stats - Global stats
  app.get('/api/admin/connections/reality/stats', async (req: FastifyRequest) => {
    const { window = '7' } = req.query as { window?: string };
    const stats = await getGlobalStats(parseInt(window));
    
    // Get distribution by level
    const leaderboard = await getLeaderboard({ windowDays: parseInt(window), limit: 1000 });
    const levelDist: Record<string, number> = {};
    for (const e of leaderboard) {
      levelDist[e.level] = (levelDist[e.level] || 0) + 1;
    }
    
    return {
      ok: true,
      data: {
        ...stats,
        levelDistribution: levelDist,
        actorsWithData: leaderboard.length,
      },
    };
  });
  
  // POST /api/admin/connections/reality/recompute - Trigger recompute
  app.post('/api/admin/connections/reality/recompute', async (req: FastifyRequest) => {
    const { window = '30' } = req.query as { window?: string };
    
    // Just refresh the leaderboard cache (if we had one)
    const leaderboard = await getLeaderboard({ windowDays: parseInt(window), limit: 500 });
    
    return {
      ok: true,
      message: `Recomputed leaderboard for ${window}d window`,
      count: leaderboard.length,
    };
  });
  
  // POST /api/admin/connections/reality/seed - Seed mock data (dev)
  app.post('/api/admin/connections/reality/seed', async (req: FastifyRequest) => {
    const { count = 100 } = (req.body ?? {}) as { count?: number };
    const seeded = await seedMockLedger(count);
    
    return {
      ok: true,
      message: `Seeded ${seeded} mock entries`,
      count: seeded,
    };
  });
  
  // POST /api/admin/connections/reality/seed-from-unified - Seed from real unified accounts
  app.post('/api/admin/connections/reality/seed-from-unified', async (req: FastifyRequest) => {
    const { countPerActor = 15 } = (req.body ?? {}) as { countPerActor?: number };
    const { seedLedgerFromUnifiedAccounts } = await import('../stores/realityLedger.store.js');
    const seeded = await seedLedgerFromUnifiedAccounts(countPerActor);
    
    return {
      ok: true,
      message: `Seeded ${seeded} entries from real unified accounts`,
      count: seeded,
    };
  });
  
  // === E4: Leaderboard Admin ===
  
  // GET /api/admin/connections/reality/leaderboard/config
  app.get('/api/admin/connections/reality/leaderboard/config', async () => {
    const config = await getLeaderboardConfig();
    return { ok: true, data: config };
  });
  
  // PATCH /api/admin/connections/reality/leaderboard/config
  app.patch('/api/admin/connections/reality/leaderboard/config', async (req: FastifyRequest) => {
    const patch = req.body as any;
    const updated = await updateLeaderboardConfig(patch);
    return { ok: true, data: updated };
  });
  
  // GET /api/admin/connections/reality/leaderboard/stats
  app.get('/api/admin/connections/reality/leaderboard/stats', async (req: FastifyRequest) => {
    const { window = '30' } = req.query as { window?: string };
    
    const leaderboard = await getLeaderboard({ windowDays: parseInt(window), limit: 1000 });
    
    // Calculate stats
    const scores = leaderboard.map(e => e.realityScore);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = Math.max(...scores, 0);
    const minScore = Math.min(...scores, 0);
    
    const totalConfirms = leaderboard.reduce((s, e) => s + e.confirms, 0);
    const totalContradicts = leaderboard.reduce((s, e) => s + e.contradicts, 0);
    
    return {
      ok: true,
      data: {
        windowDays: parseInt(window),
        actorsCount: leaderboard.length,
        avgScore: Math.round(avgScore),
        maxScore,
        minScore,
        totalConfirms,
        totalContradicts,
        confirmRate: totalConfirms + totalContradicts > 0 
          ? Math.round(100 * totalConfirms / (totalConfirms + totalContradicts))
          : 0,
      },
    };
  });

  console.log('[Reality] Admin routes registered');
}
