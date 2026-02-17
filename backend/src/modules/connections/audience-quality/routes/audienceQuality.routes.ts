/**
 * AQE Public Routes
 * 
 * Public API for audience quality metrics.
 */

import type { FastifyInstance } from 'fastify';
import type { AudienceQualityEngine } from '../core/audienceQuality.engine.js';
import type { AudienceQualityCacheStore } from '../storage/audienceQuality.cache.store.js';

export function registerAudienceQualityRoutes(
  app: FastifyInstance,
  deps: {
    engine: AudienceQualityEngine;
    cache: AudienceQualityCacheStore;
  }
) {
  // Get AQE for actor (with cache)
  app.get('/api/connections/audience-quality/:actorId', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };

    // Try cache first
    const cached = await deps.cache.get(actorId);
    if (cached) {
      return reply.send({ ok: true, cached: true, data: cached });
    }

    // Compute fresh
    const result = await deps.engine.evaluate(actorId);
    if (!result) {
      return reply.code(404).send({ ok: false, error: 'NO_DATA', message: 'No follower data available for this actor' });
    }

    // Cache and return
    await deps.cache.set(actorId, result);
    return reply.send({ ok: true, cached: false, data: result });
  });

  // Get AQE summary (lighter endpoint for cards)
  app.get('/api/connections/audience-quality/:actorId/summary', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };

    const cached = await deps.cache.get(actorId);
    if (cached) {
      return reply.send({
        ok: true,
        data: {
          actorId: cached.actorId,
          real_audience_pct: cached.real_audience_pct,
          bot_pressure_pct: cached.bot_pressure_pct,
          confidence_level: cached.confidence_level,
          anomaly: cached.anomaly.anomaly,
        },
      });
    }

    // Compute if not cached
    const result = await deps.engine.evaluate(actorId);
    if (!result) {
      return reply.code(404).send({ ok: false, error: 'NO_DATA' });
    }

    await deps.cache.set(actorId, result);
    return reply.send({
      ok: true,
      data: {
        actorId: result.actorId,
        real_audience_pct: result.real_audience_pct,
        bot_pressure_pct: result.bot_pressure_pct,
        confidence_level: result.confidence_level,
        anomaly: result.anomaly.anomaly,
      },
    });
  });

  // Admin: Force recompute
  app.post('/api/admin/connections/audience-quality/:actorId/recompute', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };

    // Clear cache
    await deps.cache.clear(actorId);

    // Recompute
    const result = await deps.engine.evaluate(actorId);
    if (!result) {
      return reply.code(404).send({ ok: false, error: 'NO_DATA' });
    }

    // Cache and return
    await deps.cache.set(actorId, result);
    return reply.send({ ok: true, data: result });
  });

  // Admin: Get cache stats
  app.get('/api/admin/connections/audience-quality/stats', async (req, reply) => {
    const stats = await deps.cache.getStats();
    return reply.send({ ok: true, stats });
  });
}
