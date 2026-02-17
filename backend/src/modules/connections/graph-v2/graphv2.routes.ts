import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { buildGraphV2 } from './graphv2.service.js';
import { GraphLayer } from './graphv2.types.js';

export async function registerGraphV2Routes(app: FastifyInstance) {
  const db = getMongoDb();

  app.get('/api/connections/graph/v2', async (req: any) => {
    const layer = (req.query.layer || 'BLENDED') as GraphLayer;
    const anchors = String(req.query.anchors || '1') === '1';
    const handle = req.query.handle as string | undefined;
    
    // Lower thresholds for FOLLOW layer (follow weights are naturally smaller)
    const isFollowLayer = layer === 'FOLLOW';
    const minConfidence = Number(req.query.minConfidence || (isFollowLayer ? 0.3 : 0.3));
    const minWeight = Number(req.query.minWeight || (isFollowLayer ? 0.01 : 0.01));

    const result = await buildGraphV2(db, {
      layer,
      anchors,
      minConfidence,
      minWeight,
      handle, // Pass handle for targeted search
    });

    return { ok: true, ...result };
  });

  console.log('[GraphV2] Routes registered at /api/connections/graph/v2');
}
