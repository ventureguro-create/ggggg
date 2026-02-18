/**
 * Alpha Scoring Routes v2
 * Phase 3 Step 3 v2 (Institutional)
 */
import { FastifyPluginAsync } from 'fastify';
import { AlphaScoringServiceV2 } from '../alpha/alpha_scoring_v2.service.js';

export const alphaScoringV2Routes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const svc = new AlphaScoringServiceV2(log);

  // Compute alpha for single channel
  fastify.post('/api/admin/telegram-intel/alpha/v2/compute/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '')
      .replace(/^@/, '')
      .toLowerCase()
      .trim();

    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    const days = Number(body.days || 90);
    return svc.compute(username, days);
  });

  // Batch compute
  fastify.post('/api/admin/telegram-intel/alpha/v2/compute/batch', async (req) => {
    const body = (req.body as any) || {};
    const limit = Number(body.limit || 50);
    const days = Number(body.days || 90);
    return svc.computeBatch(limit, days);
  });

  // Leaderboard
  fastify.get('/api/admin/telegram-intel/alpha/v2/leaderboard', async (req) => {
    const q = (req.query as any) || {};
    const limit = Number(q.limit || 20);
    return svc.getLeaderboard(limit);
  });

  // Get channel score
  fastify.get('/api/admin/telegram-intel/alpha/v2/score/:username', async (req, reply) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();

    const result = await svc.getChannelScore(u);
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }
    return result;
  });

  // Stats
  fastify.get('/api/admin/telegram-intel/alpha/v2/stats', async () => {
    return svc.getStats();
  });

  fastify.log.info('[alpha-v2] routes registered');
};
