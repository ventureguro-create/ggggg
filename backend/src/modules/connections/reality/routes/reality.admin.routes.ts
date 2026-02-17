/**
 * Reality Admin Routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RealityEvaluatorService } from '../services/reality-evaluator.service.js';
import { RealityLedgerStore } from '../storage/reality-ledger.store.js';
import { buildNeutralEventManual } from '../services/neutral-event.builder.js';

const TestEventSchema = z.object({
  eventId: z.string(),
  asset: z.string(),
  actorId: z.string().optional(),
  occurredAt: z.string().optional(),
});

export async function registerRealityAdminRoutes(
  app: FastifyInstance,
  deps: {
    evaluator: RealityEvaluatorService;
    ledger: RealityLedgerStore;
  }
) {
  // Test evaluate an event
  app.post('/test', async (req) => {
    const body = TestEventSchema.parse((req as any).body);
    const event = buildNeutralEventManual(body);
    const result = await deps.evaluator.evaluate(event);
    return { ok: true, data: result };
  });

  // Get ledger stats
  app.get('/stats', async () => {
    const stats = await deps.ledger.getStats();
    return { ok: true, data: stats };
  });

  console.log('[Reality] Admin routes registered');
}
