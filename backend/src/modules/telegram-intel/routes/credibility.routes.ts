/**
 * Credibility Routes
 * Phase 3 Step 4
 */
import { FastifyPluginAsync } from 'fastify';
import { CredibilityService } from '../credibility/credibility.service.js';

export const credibilityRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const svc = new CredibilityService(log);

  // Compute credibility for single channel
  fastify.post('/api/admin/telegram-intel/credibility/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '')
      .replace(/^@/, '')
      .toLowerCase()
      .trim();

    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    const halfLifeDays = Number(body.halfLifeDays || 21);
    const doc = await svc.compute(username, { halfLifeDays });
    return { ok: true, doc };
  });

  // Batch compute
  fastify.post('/api/admin/telegram-intel/credibility/batch', async (req) => {
    const body = (req.body as any) || {};
    const limit = Number(body.limit || 50);
    return svc.computeBatch(limit);
  });

  // Get channel credibility
  fastify.get('/api/admin/telegram-intel/credibility/:username', async (req, reply) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();

    const result = await svc.getChannelCredibility(u);
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }
    return result;
  });

  // Leaderboard
  fastify.get('/api/admin/telegram-intel/credibility/leaderboard', async (req) => {
    const q = (req.query as any) || {};
    const limit = Number(q.limit || 20);
    return svc.getLeaderboard(limit);
  });

  fastify.log.info('[credibility] routes registered');
};
