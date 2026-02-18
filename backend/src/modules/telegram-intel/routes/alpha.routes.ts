/**
 * Alpha Routes
 * Admin API for Token Mentions (Phase 3 Step 1)
 */
import { FastifyPluginAsync } from 'fastify';
import { TokenMentionsService } from '../alpha/mentions.service.js';

export const alphaRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const svc = new TokenMentionsService(log);

  // Scan channel posts for token mentions
  fastify.post('/api/admin/telegram-intel/alpha/scan/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '')
      .replace(/^@/, '')
      .replace(/^https?:\/\/t\.me\//i, '')
      .toLowerCase()
      .trim();

    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    const days = Number(body.days || 30);
    const minConfidence = Number(body.minConfidence || 0.35);

    return svc.scanChannel(username, days, minConfidence);
  });

  // List token mentions for a channel
  fastify.get('/api/admin/telegram-intel/alpha/mentions/:username', async (req) => {
    const { username } = req.params as any;
    const q = (req.query as any) || {};
    const days = Number(q.days || 30);
    const limit = Number(q.limit || 200);

    const normalizedUsername = String(username)
      .replace(/^@/, '')
      .toLowerCase()
      .trim();

    return svc.listMentions(normalizedUsername, days, limit);
  });

  // Get aggregate stats
  fastify.get('/api/admin/telegram-intel/alpha/stats', async (req) => {
    const q = (req.query as any) || {};
    const days = Number(q.days || 30);

    return svc.getStats(days);
  });

  // Batch scan multiple channels
  fastify.post('/api/admin/telegram-intel/alpha/scan/batch', async (req) => {
    const body = (req.body as any) || {};
    const usernames = (body.usernames || []) as string[];
    const days = Number(body.days || 30);
    const minConfidence = Number(body.minConfidence || 0.35);

    if (!usernames.length) {
      return { ok: false, error: 'usernames_required' };
    }

    const results = [];
    for (const u of usernames.slice(0, 20)) {
      const username = String(u)
        .replace(/^@/, '')
        .replace(/^https?:\/\/t\.me\//i, '')
        .toLowerCase()
        .trim();

      if (!username) continue;

      try {
        const result = await svc.scanChannel(username, days, minConfidence);
        results.push(result);
      } catch (err: any) {
        results.push({
          ok: false,
          username,
          error: String(err?.message || err),
        });
      }
    }

    const totalCreated = results
      .filter((r) => r.ok)
      .reduce((sum, r) => sum + ((r as any).mentionsCreated || 0), 0);

    return {
      ok: true,
      channelsProcessed: results.length,
      totalMentionsCreated: totalCreated,
      results,
    };
  });

  fastify.log.info('[alpha] routes registered');
};
