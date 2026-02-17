/**
 * БЛОК 14 — Asset Lifecycle Routes
 */

import { FastifyInstance } from 'fastify';
import { AssetLifecycleService } from './asset-lifecycle.service.js';
import { LifecyclePhase } from './asset-lifecycle.types.js';

export async function registerAssetLifecycleRoutes(
  app: FastifyInstance,
  service: AssetLifecycleService
): Promise<void> {
  // GET /api/connections/lifecycle/:asset
  app.get('/api/connections/lifecycle/:asset', async (req, reply) => {
    const { asset } = req.params as { asset: string };
    const state = await service.getAssetState(asset.toUpperCase());
    if (!state) {
      return reply.status(404).send({ ok: false, error: 'Asset not found' });
    }
    return reply.send({ ok: true, data: state });
  });

  // GET /api/connections/lifecycle
  app.get('/api/connections/lifecycle', async (req, reply) => {
    const { phase } = req.query as { phase?: LifecyclePhase };
    const states = phase 
      ? await service.getByPhase(phase)
      : await service.getAllStates();
    return reply.send({ ok: true, data: states });
  });

  // POST /api/admin/connections/lifecycle/update
  app.post('/api/admin/connections/lifecycle/update', async (req, reply) => {
    const { asset, features, window = '4h' } = req.body as any;
    if (!asset || !features) {
      return reply.status(400).send({ ok: false, error: 'Missing asset or features' });
    }
    const state = await service.updateAssetState(asset.toUpperCase(), features, window);
    return reply.send({ ok: true, data: state });
  });
}
