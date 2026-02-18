/**
 * Alpha Scoring Routes
 * Phase 3 Step 3: API for channel alpha scoring
 */
import { FastifyPluginAsync } from 'fastify';
import { AlphaScoringService } from '../alpha/alpha_scoring.service.js';

export const alphaScoringRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const svc = new AlphaScoringService(log);

  // Calculate alpha score for a single channel
  fastify.post('/api/admin/telegram-intel/alpha/score/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '')
      .replace(/^@/, '')
      .replace(/^https?:\/\/t\.me\//i, '')
      .toLowerCase()
      .trim();

    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    const windowDays = Number(body.windowDays || 90);

    return svc.calculateChannelAlpha(username, windowDays);
  });

  // Batch calculate scores for channels
  fastify.post('/api/admin/telegram-intel/alpha/score/batch', async (req) => {
    const body = (req.body as any) || {};
    const limit = Number(body.limit || 50);
    const windowDays = Number(body.windowDays || 90);

    return svc.calculateBatch(limit, windowDays);
  });

  // Get leaderboard (top channels by alpha score)
  fastify.get('/api/admin/telegram-intel/alpha/leaderboard', async (req) => {
    const q = (req.query as any) || {};
    const limit = Number(q.limit || 20);

    return svc.getLeaderboard(limit);
  });

  // Get channel alpha details
  fastify.get('/api/admin/telegram-intel/alpha/score/:username', async (req, reply) => {
    const { username } = req.params as any;
    const normalizedUsername = String(username)
      .replace(/^@/, '')
      .toLowerCase()
      .trim();

    const result = await svc.getChannelAlpha(normalizedUsername);

    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }

    return result;
  });

  // Get scoring stats
  fastify.get('/api/admin/telegram-intel/alpha/scoring-stats', async () => {
    return svc.getStats();
  });

  fastify.log.info('[alpha-scoring] routes registered');
};
