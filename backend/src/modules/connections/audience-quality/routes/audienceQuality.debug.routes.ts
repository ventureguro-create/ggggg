/**
 * AQE Debug Routes (Admin only)
 * 
 * For debugging and validating AQE logic:
 * - View raw follower samples
 * - Preview classification without caching
 */

import type { FastifyInstance } from 'fastify';
import type { IAudienceFollowerReader } from '../ports/audienceFollower.reader.port.js';
import type { AudienceQualityEngine } from '../core/audienceQuality.engine.js';
import { classifyFollower } from '../core/audienceQuality.classifier.js';
import { DEFAULT_AQE_CONFIG } from '../contracts/audienceQuality.config.js';

export function registerAudienceQualityDebugRoutes(
  app: FastifyInstance,
  deps: {
    reader: IAudienceFollowerReader;
    engine: AudienceQualityEngine;
  }
) {
  /**
   * RAW sample - see what comes from reader
   */
  app.get('/api/admin/connections/audience-quality/:actorId/sample', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };
    const query = req.query as { sampleSize?: string };
    const sampleSize = Number(query.sampleSize ?? 50);

    const sample = await deps.reader.sampleFollowers({ actorId, sampleSize });

    return reply.send({
      ok: true,
      source: process.env.AQE_SOURCE ?? 'AUTO',
      actorId,
      sampleSize,
      followersCount: sample?.followers?.length ?? 0,
      sample,
    });
  });

  /**
   * Classification preview - see how AQE classifies followers
   */
  app.get('/api/admin/connections/audience-quality/:actorId/classify', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };
    const query = req.query as { sampleSize?: string };
    const sampleSize = Number(query.sampleSize ?? 50);

    const sample = await deps.reader.sampleFollowers({ actorId, sampleSize });
    if (!sample?.followers?.length) {
      return reply.code(404).send({ ok: false, error: 'NO_DATA' });
    }

    const classified = sample.followers.map(f => 
      classifyFollower({
        followerId: f.id,
        username: f.username,
        profile: {
          createdAt: f.createdAt,
          tweetsTotal: f.tweetsTotal,
          tweetsLast30d: f.tweetsLast30d,
          followersCount: f.followersCount,
          followingCount: f.followingCount,
          avgLikes: f.avgLikes,
          avgRetweets: f.avgRetweets,
          activityDaysLast30: f.activityDaysLast30,
          hasAvatar: f.hasAvatar,
          hasBio: f.hasBio,
        },
        cfg: DEFAULT_AQE_CONFIG,
      })
    );

    const breakdown = {
      real: classified.filter(x => x.label === 'REAL').length,
      low_quality: classified.filter(x => x.label === 'LOW_QUALITY').length,
      bot_likely: classified.filter(x => x.label === 'BOT_LIKELY').length,
      farm_node: classified.filter(x => x.label === 'FARM_NODE').length,
    };

    return reply.send({
      ok: true,
      actorId,
      sampleSize: classified.length,
      breakdown,
      classified: classified.slice(0, 20), // First 20 for debug view
    });
  });

  /**
   * Full evaluation (no cache)
   */
  app.get('/api/admin/connections/audience-quality/:actorId/evaluate', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };

    const result = await deps.engine.evaluate(actorId);
    if (!result) {
      return reply.code(404).send({ ok: false, error: 'NO_DATA' });
    }

    return reply.send({
      ok: true,
      result,
    });
  });
}
