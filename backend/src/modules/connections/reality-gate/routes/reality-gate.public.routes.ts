/**
 * Reality Gate Public Routes
 */

import { FastifyInstance } from 'fastify';
import { RealityGateAuditStore } from '../services/reality-gate-audit.store.js';

export async function registerRealityGatePublicRoutes(
  app: FastifyInstance,
  deps: { auditStore: RealityGateAuditStore }
) {
  // Get gate result for specific event
  app.get('/event/:eventId', async (req) => {
    const { eventId } = (req as any).params;
    const result = await deps.auditStore.getByEvent(eventId);
    return { ok: true, data: result };
  });

  // Get actor reality history
  app.get('/actor/:actorId', async (req) => {
    const { actorId } = (req as any).params;
    const limit = Number((req as any).query.limit || 20);
    const entries = await deps.auditStore.listByActor(actorId, limit);
    
    // Calculate summary stats
    const total = entries.length;
    const confirmed = entries.filter(e => e.onchain.verdict === 'CONFIRMED').length;
    const contradicted = entries.filter(e => e.onchain.verdict === 'CONTRADICTED').length;
    const blocked = entries.filter(e => e.decision === 'BLOCK').length;
    
    return { 
      ok: true, 
      data: {
        actorId,
        summary: {
          total,
          confirmed,
          contradicted,
          blocked,
          confirmRate: total > 0 ? confirmed / total : 0,
          contradictRate: total > 0 ? contradicted / total : 0,
        },
        recent: entries.slice(0, 10),
      },
    };
  });

  console.log('[RealityGate] Public routes registered');
}
