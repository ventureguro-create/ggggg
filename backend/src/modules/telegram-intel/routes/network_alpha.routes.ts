/**
 * Network Alpha Routes
 */
import { FastifyPluginAsync } from 'fastify';
import { NetworkAlphaService } from '../network-alpha/network_alpha.service.js';

export const networkAlphaRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const svc = new NetworkAlphaService(log);

  // Run network alpha computation
  fastify.post('/api/admin/telegram-intel/network-alpha/run', async (req) => {
    const body = (req.body as any) || {};
    const lookbackDays = Number(body.lookbackDays || 90);
    return svc.compute(lookbackDays);
  });

  // Get top channels by network alpha (public)
  fastify.get('/api/telegram-intel/network-alpha/top', async (req) => {
    const q = (req.query as any) || {};
    const limit = Math.max(1, Math.min(200, Number(q.limit || 50)));
    const minScore = q.minScore ? Number(q.minScore) : undefined;

    return svc.getLeaderboard(limit, minScore);
  });

  // Get channel network alpha (public)
  fastify.get('/api/telegram-intel/network-alpha/channel/:username', async (req, reply) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase();

    const result = await svc.getChannelNetworkAlpha(u);
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }
    return result;
  });

  // Get token network alpha (public)
  fastify.get('/api/telegram-intel/network-alpha/token/:token', async (req, reply) => {
    const { token } = req.params as any;
    const t = String(token).toUpperCase();

    const result = await svc.getTokenNetworkAlpha(t);
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }
    return result;
  });

  fastify.log.info('[network-alpha] routes registered');
};
