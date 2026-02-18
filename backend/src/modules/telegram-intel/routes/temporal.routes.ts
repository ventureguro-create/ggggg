/**
 * Temporal Routes
 * Score evolution and top movers
 */
import { FastifyPluginAsync } from 'fastify';
import { TemporalSnapshotService } from '../temporal/temporal_snapshot.service.js';
import { TemporalTrendService } from '../temporal/temporal_trend.service.js';

export const temporalRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);

  const snapshot = new TemporalSnapshotService(log);
  const trend = new TemporalTrendService();

  // Run batch snapshot
  fastify.post('/api/admin/telegram-intel/temporal/snapshot/run', async (req) => {
    const body = (req.body as any) || {};
    const limit = Number(body.limit || 500);
    return snapshot.snapshotBatch(limit);
  });

  // Snapshot single channel
  fastify.post('/api/admin/telegram-intel/temporal/snapshot/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '')
      .replace(/^@/, '')
      .toLowerCase();
    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }
    return snapshot.snapshotChannel(username);
  });

  // Get channel score history (public)
  fastify.get('/api/telegram-intel/temporal/:username', async (req, reply) => {
    const { username } = req.params as any;
    const q = (req.query as any) || {};
    const days = Math.max(1, Math.min(365, Number(q.days || 90)));

    const u = String(username).replace(/^@/, '').toLowerCase();

    const result = await trend.getChannelHistory(u, days);
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: 'no_data' });
    }
    return result;
  });

  // Get top movers (public)
  fastify.get('/api/telegram-intel/temporal/top-movers', async (req) => {
    const q = (req.query as any) || {};
    const days = Math.max(1, Math.min(90, Number(q.days || 7)));
    const metric = String(q.metric || 'intelScore');
    const limit = Math.max(1, Math.min(200, Number(q.limit || 50)));

    return trend.topMovers(days, metric, limit);
  });

  fastify.log.info('[temporal] routes registered');
};
