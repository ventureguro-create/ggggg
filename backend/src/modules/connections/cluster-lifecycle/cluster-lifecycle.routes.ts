/**
 * БЛОК 15 — Cluster Lifecycle Routes
 */

import { FastifyInstance } from 'fastify';
import { ClusterLifecycleService } from './cluster-lifecycle.service.js';
import { LifecyclePhase } from '../asset-lifecycle/asset-lifecycle.types.js';

export async function registerClusterLifecycleRoutes(
  app: FastifyInstance,
  service: ClusterLifecycleService
): Promise<void> {
  // GET /api/connections/cluster-lifecycle/:cluster
  app.get('/api/connections/cluster-lifecycle/:cluster', async (req, reply) => {
    const { cluster } = req.params as { cluster: string };
    const state = await service.getClusterState(cluster.toUpperCase());
    if (!state) {
      return reply.status(404).send({ ok: false, error: 'Cluster not found' });
    }
    return reply.send({ ok: true, data: state });
  });

  // GET /api/connections/cluster-lifecycle
  app.get('/api/connections/cluster-lifecycle', async (req, reply) => {
    const { phase } = req.query as { phase?: LifecyclePhase };
    const states = phase
      ? await service.getClustersByPhase(phase)
      : await service.getAllClusterStates();
    return reply.send({ ok: true, data: states });
  });

  // POST /api/admin/connections/cluster-lifecycle/update
  app.post('/api/admin/connections/cluster-lifecycle/update', async (req, reply) => {
    const { cluster, assets, window = '4h' } = req.body as any;
    if (!cluster || !assets) {
      return reply.status(400).send({ ok: false, error: 'Missing cluster or assets' });
    }
    const state = await service.updateClusterState(cluster.toUpperCase(), assets, window);
    return reply.send({ ok: true, data: state });
  });
}
