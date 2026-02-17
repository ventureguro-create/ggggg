/**
 * Reality Public Routes (read-only for UI)
 */

import { FastifyInstance } from 'fastify';
import { RealityLedgerStore } from '../storage/reality-ledger.store.js';

export async function registerRealityPublicRoutes(
  app: FastifyInstance,
  deps: { ledger: RealityLedgerStore }
) {
  app.get('/by-asset/:asset', async (req) => {
    const { asset } = (req as any).params;
    const limit = Number((req as any).query.limit || 50);
    const entries = await deps.ledger.listByAsset(asset, limit);
    return { ok: true, data: entries };
  });

  app.get('/by-actor/:actorId', async (req) => {
    const { actorId } = (req as any).params;
    const limit = Number((req as any).query.limit || 50);
    const entries = await deps.ledger.listByActor(actorId, limit);
    return { ok: true, data: entries };
  });

  app.get('/event/:eventId', async (req) => {
    const { eventId } = (req as any).params;
    const entry = await deps.ledger.getByEvent(eventId);
    return { ok: true, data: entry };
  });

  app.get('/stats', async () => {
    const stats = await deps.ledger.getStats();
    return { ok: true, data: stats };
  });

  console.log('[Reality] Public routes registered');
}
