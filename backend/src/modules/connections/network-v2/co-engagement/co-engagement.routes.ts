/**
 * Co-Engagement Routes - Network v2
 * 
 * Admin API for co-engagement network management
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getCoEngConfig,
  updateCoEngConfig,
  buildNetwork,
  getLatestSnapshot,
  getNetworkStats,
} from './co-engagement.service.js';

export function registerCoEngagementRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/network-v2/co-engagement';
  
  // ============================================================
  // GET /config - Get co-engagement config
  // ============================================================
  app.get(`${PREFIX}/config`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getCoEngConfig();
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // PATCH /config - Update config
  // ============================================================
  app.patch(`${PREFIX}/config`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Partial<any>;
      const config = await updateCoEngConfig(body);
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /build - Build network (dry run or save)
  // ============================================================
  app.post(`${PREFIX}/build`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { dry_run?: boolean; author_ids?: string[] } | undefined;
      
      const result = await buildNetwork({
        dry_run: body?.dry_run ?? true,
        author_ids: body?.author_ids,
      });
      
      return reply.send({
        ok: true,
        message: body?.dry_run ? 'Dry run complete' : 'Network built and saved',
        data: {
          stats: result.stats,
          edges_sample: result.edges.slice(0, 10),
          nodes_count: result.nodes.length,
        },
      });
    } catch (err: any) {
      console.error('[CoEngagement] Build error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /stats - Get network stats
  // ============================================================
  app.get(`${PREFIX}/stats`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getNetworkStats();
      return reply.send({ ok: true, data: stats });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /snapshot - Get latest snapshot
  // ============================================================
  app.get(`${PREFIX}/snapshot`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const snapshot = await getLatestSnapshot();
      
      if (!snapshot) {
        return reply.send({
          ok: true,
          data: null,
          message: 'No snapshot available. Run POST /build first.',
        });
      }
      
      return reply.send({
        ok: true,
        data: {
          stats: snapshot.stats,
          edges_count: snapshot.edges.length,
          nodes_count: snapshot.nodes.length,
          edges_sample: snapshot.edges.slice(0, 20),
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[CoEngagement] Routes registered at ${PREFIX}/*`);
}
