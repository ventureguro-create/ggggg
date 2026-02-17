/**
 * Follower Graph Routes
 */

import type { FastifyInstance } from 'fastify';
import type { IAudienceFollowerReader } from '../ports/audienceFollower.reader.port.js';
import { classifyFollower } from '../core/audienceQuality.classifier.js';
import { DEFAULT_AQE_CONFIG } from '../contracts/audienceQuality.config.js';
import { buildFollowerGraph, calculateGraphPenalty } from './follower-graph.service.js';

export function registerFollowerGraphRoutes(
  app: FastifyInstance,
  deps: {
    reader: IAudienceFollowerReader;
  }
) {
  /**
   * Get follower graph for an actor
   */
  app.get('/api/connections/audience-quality/:actorId/graph', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };
    const query = req.query as { sampleSize?: string };
    const sampleSize = Number(query.sampleSize ?? 200);

    // Get follower sample
    const sample = await deps.reader.sampleFollowers({ actorId, sampleSize });
    if (!sample?.followers?.length) {
      return reply.code(404).send({ ok: false, error: 'NO_DATA' });
    }

    // Classify followers
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

    // Build graph
    const graph = buildFollowerGraph(actorId, classified);
    const { penalty, reason } = calculateGraphPenalty(graph);

    return reply.send({
      ok: true,
      graph,
      penalty: {
        value: penalty,
        reason,
      },
    });
  });

  /**
   * Get clusters only (lighter endpoint)
   */
  app.get('/api/connections/audience-quality/:actorId/clusters', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };
    const query = req.query as { sampleSize?: string };
    const sampleSize = Number(query.sampleSize ?? 200);

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

    const graph = buildFollowerGraph(actorId, classified);

    return reply.send({
      ok: true,
      actorId,
      clustersCount: graph.clustersCount,
      suspiciousClusters: graph.suspiciousClusters,
      botClusterRatio: graph.botClusterRatio,
      largestClusterSize: graph.largestClusterSize,
      clusters: graph.clusters,
    });
  });
}
