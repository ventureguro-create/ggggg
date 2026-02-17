/**
 * Pilot Admin Routes (Phase 4.6)
 * 
 * Admin API for pilot rollout management.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getPilotStore,
  startPilotStep,
  checkPilotReadiness,
  type PilotAccount,
  type PilotAccountType,
  type PilotStep,
  type PilotConfig,
} from './pilot.store.js';

export async function registerPilotRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /config
   * Get pilot configuration
   */
  fastify.get('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const config = await store.getConfig();
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * PATCH /config
   * Update pilot configuration
   */
  fastify.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const updates = req.body as Partial<PilotConfig>;
      const config = await store.updateConfig(updates, 'admin');
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /accounts
   * Get pilot accounts
   */
  fastify.get('/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const { active, type } = req.query as { active?: string; type?: PilotAccountType };
      
      const filter: { active?: boolean; type?: PilotAccountType } = {};
      if (active !== undefined) filter.active = active === 'true';
      if (type) filter.type = type;
      
      const accounts = await store.getAccounts(filter);
      return reply.send({ ok: true, data: accounts });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /accounts
   * Add pilot account
   */
  fastify.post('/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const body = req.body as {
        account_id: string;
        username: string;
        type: PilotAccountType;
      };
      
      if (!body.account_id || !body.username || !body.type) {
        return reply.status(400).send({ ok: false, error: 'account_id, username, and type required' });
      }
      
      const account = await store.addAccount({
        account_id: body.account_id,
        username: body.username,
        type: body.type,
        added_by: 'admin',
      });
      
      return reply.send({ ok: true, data: account });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * DELETE /accounts/:account_id
   * Remove pilot account
   */
  fastify.delete('/accounts/:account_id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const { account_id } = req.params as { account_id: string };
      
      await store.removeAccount(account_id);
      return reply.send({ ok: true, message: `Account ${account_id} removed` });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /accounts/:account_id/rollback
   * Rollback specific pilot account
   */
  fastify.post('/accounts/:account_id/rollback', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const { account_id } = req.params as { account_id: string };
      const { reason } = req.body as { reason?: string };
      
      await store.rollbackAccount(account_id, reason || 'manual_rollback');
      return reply.send({ ok: true, message: `Account ${account_id} rolled back` });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /stats
   * Get pilot statistics
   */
  fastify.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const stats = await store.getStats();
      return reply.send({ ok: true, data: stats });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /readiness
   * Check if pilot is ready to start
   */
  fastify.get('/readiness', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await checkPilotReadiness();
      return reply.send({ ok: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /step
   * Start pilot step (A, B, C, or OFF)
   */
  fastify.post('/step', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { step } = req.body as { step: PilotStep };
      
      if (!['A', 'B', 'C', 'OFF'].includes(step)) {
        return reply.status(400).send({ ok: false, error: 'Invalid step. Must be A, B, C, or OFF' });
      }
      
      // Check readiness before starting
      if (step !== 'OFF') {
        const readiness = await checkPilotReadiness();
        if (!readiness.ready) {
          return reply.status(400).send({
            ok: false,
            error: 'Pilot not ready',
            blockers: readiness.blockers,
          });
        }
      }
      
      const config = await startPilotStep(step, 'admin');
      return reply.send({
        ok: true,
        message: step === 'OFF' ? 'Pilot disabled' : `Pilot step ${step} started`,
        data: config,
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /metrics
   * Get pilot metrics history
   */
  fastify.get('/metrics', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      const { limit } = req.query as { limit?: string };
      const metrics = await store.getMetricsHistory(parseInt(limit || '50', 10));
      return reply.send({ ok: true, data: metrics });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /accounts/seed
   * Seed pilot accounts (for quick setup)
   */
  fastify.post('/accounts/seed', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const store = getPilotStore();
      
      // Default pilot accounts mix
      const seedAccounts: Array<{ account_id: string; username: string; type: PilotAccountType }> = [
        // Whales (2-3)
        { account_id: 'pilot_whale_001', username: 'crypto_whale', type: 'whale' },
        { account_id: 'pilot_whale_002', username: 'btc_maxi', type: 'whale' },
        
        // Influencers (4-6)
        { account_id: 'pilot_inf_001', username: 'alpha_hunter', type: 'influencer' },
        { account_id: 'pilot_inf_002', username: 'defi_expert', type: 'influencer' },
        { account_id: 'pilot_inf_003', username: 'nft_trader', type: 'influencer' },
        { account_id: 'pilot_inf_004', username: 'yield_farmer', type: 'influencer' },
        { account_id: 'pilot_inf_005', username: 'onchain_analyst', type: 'influencer' },
        
        // Retail (3-5)
        { account_id: 'pilot_retail_001', username: 'new_trader_1', type: 'retail' },
        { account_id: 'pilot_retail_002', username: 'breakout_watch', type: 'retail' },
        { account_id: 'pilot_retail_003', username: 'gem_finder', type: 'retail' },
        { account_id: 'pilot_retail_004', username: 'micro_alpha', type: 'retail' },
        
        // Suspicious (1-2)
        { account_id: 'pilot_sus_001', username: 'maybe_bot', type: 'suspicious' },
      ];
      
      const results = [];
      for (const acc of seedAccounts) {
        try {
          const result = await store.addAccount({
            ...acc,
            added_by: 'seed',
          });
          results.push({ ...acc, status: 'added' });
        } catch (err: any) {
          results.push({ ...acc, status: 'exists' });
        }
      }
      
      return reply.send({
        ok: true,
        message: `Seeded ${results.filter(r => r.status === 'added').length} accounts`,
        data: results,
      });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log('[Pilot] Routes registered at /api/admin/connections/pilot/*');
}
