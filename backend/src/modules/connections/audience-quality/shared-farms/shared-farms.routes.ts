/**
 * Shared Bot Farms Routes
 */

import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';
import { analyzeSharedFarms } from './shared-farms.service.js';

export function registerSharedFarmsRoutes(app: FastifyInstance, db: Db) {
  /**
   * Analyze shared bot farms for an influencer
   */
  app.get('/api/connections/audience-quality/:actorId/shared-farms', async (req, reply) => {
    const { actorId } = req.params as { actorId: string };
    const query = req.query as { minShared?: string };
    const minSharedFollowers = Number(query.minShared ?? 5);

    const analysis = await analyzeSharedFarms(db, actorId, { minSharedFollowers });

    return reply.send({
      ok: true,
      analysis,
    });
  });

  /**
   * Get all detected farms (admin)
   */
  app.get('/api/admin/connections/audience-quality/farms', async (req, reply) => {
    const query = req.query as { limit?: string };
    const limit = Number(query.limit ?? 20);

    // Get all AQE cached entries
    const aqeCache = db.collection('connections_aqe_cache');
    const actors = await aqeCache.find({}).limit(100).toArray();

    // Analyze farms for top actors
    const allFarms: any[] = [];
    
    for (const actor of actors.slice(0, limit)) {
      const analysis = await analyzeSharedFarms(db, actor._id, { minSharedFollowers: 3 });
      if (analysis.farms.length > 0) {
        allFarms.push({
          actorId: actor._id,
          handle: actor.twitterHandle,
          manipulationRisk: analysis.manipulationRisk,
          farmsCount: analysis.farms.length,
          highRiskFarms: analysis.highRiskFarms,
          totalSharedBots: analysis.totalSharedBots,
        });
      }
    }

    return reply.send({
      ok: true,
      count: allFarms.length,
      farms: allFarms.sort((a, b) => b.totalSharedBots - a.totalSharedBots),
    });
  });

  /**
   * Get influencers connected by shared farms
   */
  app.get('/api/admin/connections/audience-quality/farm-network', async (req, reply) => {
    const query = req.query as { limit?: string };
    const limit = Number(query.limit ?? 50);

    const aqeCache = db.collection('connections_aqe_cache');
    const actors = await aqeCache.find({}).limit(limit).toArray();

    // Build network
    const nodes: any[] = [];
    const edges: any[] = [];
    const seenEdges = new Set<string>();

    for (const actor of actors) {
      nodes.push({
        id: actor._id,
        handle: actor.twitterHandle,
        botPressure: actor.bot_pressure_pct,
      });

      const analysis = await analyzeSharedFarms(db, actor._id, { minSharedFollowers: 3 });
      
      for (const conn of analysis.connectedInfluencers) {
        const edgeKey = [actor._id, conn.actorId].sort().join('_');
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          edges.push({
            from: actor._id,
            to: conn.actorId,
            sharedBots: conn.sharedBots,
          });
        }
      }
    }

    return reply.send({
      ok: true,
      nodes,
      edges,
    });
  });
}
