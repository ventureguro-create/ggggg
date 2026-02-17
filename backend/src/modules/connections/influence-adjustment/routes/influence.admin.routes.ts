/**
 * Influence Admin Routes
 */

import { FastifyInstance } from 'fastify';
import { InfluenceHistoryStore } from '../storage/influence-history.store.js';
import { ActorTrustService } from '../services/actor-trust.service.js';

export async function registerInfluenceAdminRoutes(
  app: FastifyInstance,
  deps: { 
    history: InfluenceHistoryStore;
    trust: ActorTrustService;
  }
) {
  app.get('/history/:actorId', async (req) => {
    const { actorId } = (req as any).params;
    const limit = Number((req as any).query.limit || 50);
    const entries = await deps.history.last(actorId, limit);
    return { ok: true, data: entries };
  });

  app.get('/trust/:actorId', async (req) => {
    const { actorId } = (req as any).params;
    const result = await deps.trust.computeTrustMultiplier(actorId);
    return { ok: true, data: result };
  });

  console.log('[Influence] Admin routes registered');
}
