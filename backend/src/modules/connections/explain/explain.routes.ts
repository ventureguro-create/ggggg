import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { explainEntity } from './explain.service.js';

export async function registerExplainRoutes(app: FastifyInstance) {
  const db = getMongoDb();

  // Explain why entity matters
  app.get('/api/connections/explain/:entityId', async (req: any) => {
    const entityId = String(req.params.entityId);
    const preset = req.query.preset as string | undefined;

    const result = await explainEntity(db, entityId, preset);
    return { ok: true, entityId, ...result };
  });

  console.log('[Explain] Routes registered at /api/connections/explain/*');
}
