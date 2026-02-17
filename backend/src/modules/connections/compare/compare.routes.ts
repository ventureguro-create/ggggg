import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { compareEntities } from './compare.service.js';

export async function registerCompareRoutes(app: FastifyInstance) {
  const db = getMongoDb();

  // Compare two entities (v2)
  app.post('/api/connections/compare/v2', async (req: any) => {
    const { left, right, preset } = req.body || {};

    if (!left || !right) {
      return { ok: false, error: 'left and right entity IDs required' };
    }

    const result = await compareEntities(db, left, right, preset);
    return { ok: true, ...result };
  });

  // GET version for easier testing
  app.get('/api/connections/compare/v2/:left/:right', async (req: any) => {
    const left = String(req.params.left);
    const right = String(req.params.right);
    const preset = req.query.preset as string | undefined;

    const result = await compareEntities(db, left, right, preset);
    return { ok: true, ...result };
  });

  console.log('[Compare] Routes registered at /api/connections/compare/v2/*');
}
