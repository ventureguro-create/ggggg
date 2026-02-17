/**
 * Influence Public Routes (read-only for UI)
 */

import { FastifyInstance } from 'fastify';
import { InfluenceAdjusterService } from '../services/influence-adjuster.service.js';

export async function registerInfluencePublicRoutes(
  app: FastifyInstance,
  deps: { adjuster: InfluenceAdjusterService }
) {
  app.get('/:actorId', async (req) => {
    const { actorId } = (req as any).params;
    const baseScore = Number((req as any).query.baseScore || 700);

    const result = await deps.adjuster.adjust({
      actorId,
      baseInfluenceScore_0_1000: baseScore,
    });

    return { ok: true, data: result };
  });

  console.log('[Influence] Public routes registered');
}
