/**
 * Co-Investment Routes
 * 
 * Admin and public API for co-investment graph.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CoInvestmentBuilder } from './coinvest.builder.service.js';
import { CoInvestmentReader } from './coinvest.reader.service.js';
import type { BuildCoInvestParams } from '../network-v2-plus.types.js';

let builder: CoInvestmentBuilder;
let reader: CoInvestmentReader;

export function initCoInvestServices(db: any): void {
  builder = new CoInvestmentBuilder(db);
  reader = new CoInvestmentReader(db);
  console.log('[CoInvest] Services initialized');
}

export function registerCoInvestAdminRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/network-v2/coinvest';

  // POST /build - Build co-investment snapshot
  app.post(`${PREFIX}/build`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = (request.body || {}) as BuildCoInvestParams;
      
      // Parse dates if strings
      if (params.fromDate && typeof params.fromDate === 'string') {
        params.fromDate = new Date(params.fromDate);
      }
      if (params.toDate && typeof params.toDate === 'string') {
        params.toDate = new Date(params.toDate);
      }

      const result = await builder.buildCoInvestment(params);
      
      return reply.send({
        ok: true,
        message: `Built ${result.edgesBuilt} co-investment edges`,
        data: result,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // POST /build-projects - Build backer→project edges
  app.post(`${PREFIX}/build-projects`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { minConfidence } = (request.body || {}) as { minConfidence?: number };
      const result = await builder.buildBackerProjects(minConfidence);
      
      return reply.send({
        ok: true,
        message: `Built ${result.edgesBuilt} backer-project edges`,
        data: result,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // GET /snapshots - List snapshots
  app.get(`${PREFIX}/snapshots`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type } = request.query as { type?: string };
      const snapshots = await reader.listSnapshots(type);
      
      return reply.send({
        ok: true,
        data: snapshots,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  console.log(`[CoInvest] Admin routes registered at ${PREFIX}/*`);
}

export function registerCoInvestReadRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/connections/network-v2/coinvest';

  // GET /edges - List co-investment edges
  app.get(`${PREFIX}/edges`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { snapshotId, minWeight, limit } = request.query as {
        snapshotId?: string;
        minWeight?: string;
        limit?: string;
      };

      const edges = await reader.listEdges(
        snapshotId,
        minWeight ? parseFloat(minWeight) : 0.2,
        limit ? parseInt(limit) : 2000
      );

      return reply.send({
        ok: true,
        data: { edges, count: edges.length },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // GET /pair - Get pair details
  app.get(`${PREFIX}/pair`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { a, b, snapshotId } = request.query as {
        a: string;
        b: string;
        snapshotId?: string;
      };

      if (!a || !b) {
        return reply.code(400).send({ ok: false, error: 'a and b are required' });
      }

      const pair = await reader.pairDetails(a, b, snapshotId);

      return reply.send({
        ok: true,
        data: pair,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  console.log(`[CoInvest] Read routes registered at ${PREFIX}/*`);
}

// Extended routes for Backer network
export function registerBackerNetworkRoutes(app: FastifyInstance): void {
  // GET /backers/:id/network - Get network around backer
  app.get('/api/connections/backers/:id/network', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { snapshotId, depth } = request.query as {
        snapshotId?: string;
        depth?: string;
      };

      const network = await reader.backerNetwork(
        id,
        snapshotId,
        depth ? parseInt(depth) : 1
      );

      return reply.send({
        ok: true,
        data: network,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // GET /backers/:id/coinvestors - Get top co-investors
  app.get('/api/connections/backers/:id/coinvestors', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { limit } = request.query as { limit?: string };

      const coinvestors = await reader.getCoInvestors(
        id,
        limit ? parseInt(limit) : 10
      );

      return reply.send({
        ok: true,
        data: { coinvestors, count: coinvestors.length },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // GET /backers/:id/investments - Get backer's portfolio investments
  app.get('/api/connections/backers/:id/investments', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { limit = 50 } = request.query as { limit?: number };
      
      const investments = await reader.getBackerInvestments(id, Number(limit));

      return reply.send({
        ok: true,
        data: { investments, count: investments.length },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  console.log('[CoInvest] Backer network routes registered');
}
