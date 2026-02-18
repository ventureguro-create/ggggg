/**
 * Intel Ranking Routes
 * Phase 3 Step 5
 */
import { FastifyPluginAsync } from 'fastify';
import { IntelRankingService } from '../ranking/intel_ranking.service.js';

export const intelRankingRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const svc = new IntelRankingService(log);

  // Compute intel for single channel
  fastify.post('/api/admin/telegram-intel/intel/compute/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '')
      .replace(/^@/, '')
      .toLowerCase()
      .trim();

    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    const doc = await svc.compute(username);
    return { ok: true, doc };
  });

  // Batch recompute
  fastify.post('/api/admin/telegram-intel/intel/recompute', async (req) => {
    const body = (req.body as any) || {};
    const limit = Number(body.limit || 200);
    return svc.recomputeBatch(limit);
  });

  // Get top channels (public)
  fastify.get('/api/telegram-intel/intel/top', async (req) => {
    const q = (req.query as any) || {};
    return svc.getTop({
      limit: Number(q.limit || 50),
      tier: q.tier || undefined,
      minScore: q.minScore ? Number(q.minScore) : undefined,
      maxFraud: q.maxFraud ? Number(q.maxFraud) : undefined,
    });
  });

  // Get channel intel (public)
  fastify.get('/api/telegram-intel/intel/:username', async (req, reply) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();

    const result = await svc.getChannelIntel(u);
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }
    return result;
  });

  fastify.log.info('[intel-ranking] routes registered');
};
