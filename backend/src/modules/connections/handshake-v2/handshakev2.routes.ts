import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { computeHandshakeV2 } from './handshakev2.service.js';

export async function registerHandshakeV2Routes(app: FastifyInstance) {
  const db = getMongoDb();

  app.post('/api/connections/handshake/v2', async (req: any) => {
    const { fromId, toId, layer } = req.body || {};
    
    if (!fromId || !toId) {
      return { ok: false, error: 'fromId and toId required' };
    }

    const result = await computeHandshakeV2(db, { fromId, toId, layer });
    return result;
  });

  // GET version for easier testing
  app.get('/api/connections/handshake/v2/:fromId/:toId', async (req: any) => {
    const fromId = String(req.params.fromId);
    const toId = String(req.params.toId);
    const layer = req.query.layer;

    const result = await computeHandshakeV2(db, { fromId, toId, layer });
    return result;
  });

  console.log('[HandshakeV2] Routes registered at /api/connections/handshake/v2');
}
