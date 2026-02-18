/**
 * Explain Routes
 * Phase 4: Human-readable explanations
 */
import { FastifyPluginAsync } from 'fastify';
import { ExplainService } from '../explain/explain.service.js';

export const explainRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new ExplainService();

  // Get explanation for channel (public)
  fastify.get('/api/telegram-intel/intel/explain/:username', async (req, reply) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();

    const res = await svc.explain(u);
    if (!res.ok) {
      return reply.status(404).send(res);
    }
    return res;
  });

  fastify.log.info('[explain] routes registered');
};
