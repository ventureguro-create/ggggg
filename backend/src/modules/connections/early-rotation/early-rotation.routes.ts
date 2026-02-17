/**
 * БЛОК 13 — Early Rotation Routes
 */

import { FastifyInstance } from 'fastify';
import { EarlyRotationService } from './early-rotation.service.js';
import { ERPClass } from './early-rotation.types.js';

export async function registerEarlyRotationRoutes(
  app: FastifyInstance,
  service: EarlyRotationService
): Promise<void> {
  // GET /api/connections/early-rotation/active
  app.get('/api/connections/early-rotation/active', async (req, reply) => {
    const { minClass = 'WATCH' } = req.query as { minClass?: ERPClass };
    const rotations = await service.getActiveRotations(minClass);
    return reply.send({ ok: true, data: rotations });
  });

  // GET /api/connections/early-rotation/history
  app.get('/api/connections/early-rotation/history', async (req, reply) => {
    const { limit = '50' } = req.query as { limit?: string };
    const rotations = await service.getRotationHistory(Number(limit));
    return reply.send({ ok: true, data: rotations });
  });

  // POST /api/admin/connections/early-rotation/detect
  app.post('/api/admin/connections/early-rotation/detect', async (req, reply) => {
    const { fromCluster, toCluster, window = '24h' } = req.body as any;
    if (!fromCluster || !toCluster) {
      return reply.status(400).send({ ok: false, error: 'Missing cluster data' });
    }
    const rotation = await service.detectRotation(fromCluster, toCluster, window);
    return reply.send({ ok: true, data: rotation });
  });
}
