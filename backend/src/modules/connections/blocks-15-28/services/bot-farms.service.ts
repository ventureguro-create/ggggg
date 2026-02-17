/**
 * BLOCK 15 - Bot Farms Service
 * 
 * Detects shared bot farms between influencers
 */

import type { Db, Collection, Document } from 'mongodb';
import { computeFarmConfidence } from '../formulas/shared-farm.penalty.js';

export interface BotFarmRecord {
  farmId: string;
  actorIds: string[];
  sharedFollowers: number;
  botRatio: number;
  suspiciousRatio: number;
  confidence: number;
  createdAt: Date;
}

export class BotFarmsService {
  private collection: Collection<Document>;

  constructor(private db: Db) {
    this.collection = db.collection('bot_farms');
  }

  /**
   * Detect shared bot farms using aggregation pipeline
   */
  async detectSharedFarms(options: {
    minSharedFollowers?: number;
    limit?: number;
  } = {}): Promise<BotFarmRecord[]> {
    const { minSharedFollowers = 5, limit = 100 } = options;

    // Pipeline to find shared bot/suspicious followers
    const pipeline = [
      {
        $match: {
          label: { $in: ['BOT', 'SUSPICIOUS', 'BOT_LIKELY', 'FARM_NODE'] }
        }
      },
      {
        $group: {
          _id: '$followerId',
          actors: { $addToSet: '$actorId' },
          labels: { $push: '$label' }
        }
      },
      {
        $match: {
          $expr: { $gte: [{ $size: '$actors' }, 2] }
        }
      },
      {
        $unwind: '$actors'
      },
      {
        $group: {
          _id: '$actors',
          sharedCount: { $sum: 1 },
          botLabels: { $push: '$labels' }
        }
      },
      {
        $match: {
          sharedCount: { $gte: minSharedFollowers }
        }
      },
      { $limit: limit }
    ];

    try {
      const results = await this.db.collection('follower_nodes')
        .aggregate(pipeline)
        .toArray();

      const farms: BotFarmRecord[] = [];

      // Group into pairs and create farm records
      for (let i = 0; i < results.length; i++) {
        for (let j = i + 1; j < results.length; j++) {
          const actorA = results[i]._id as string;
          const actorB = results[j]._id as string;
          const sharedFollowers = Math.min(results[i].sharedCount, results[j].sharedCount);

          if (sharedFollowers >= minSharedFollowers) {
            const botRatio = 0.7; // Simplified - all are suspicious
            const confidence = computeFarmConfidence({
              sharedFollowers,
              botRatio,
              avgFollowersA: 1000, // Would need to fetch actual counts
              avgFollowersB: 1000
            });

            farms.push({
              farmId: `farm_${actorA}_${actorB}`,
              actorIds: [actorA, actorB],
              sharedFollowers,
              botRatio,
              suspiciousRatio: 1 - botRatio,
              confidence,
              createdAt: new Date()
            });
          }
        }
      }

      return farms;
    } catch (error) {
      console.error('[BotFarmsService] Error detecting farms:', error);
      return [];
    }
  }

  /**
   * Get farms for a specific actor
   */
  async getFarmsForActor(actorId: string): Promise<BotFarmRecord[]> {
    try {
      const farms = await this.collection
        .find({ actorIds: actorId })
        .sort({ confidence: -1 })
        .limit(50)
        .toArray();

      return farms as unknown as BotFarmRecord[];
    } catch (error) {
      console.error('[BotFarmsService] Error getting farms for actor:', error);
      return [];
    }
  }

  /**
   * Get all bot farms
   */
  async getAllFarms(options: { limit?: number; minConfidence?: number } = {}): Promise<BotFarmRecord[]> {
    const { limit = 100, minConfidence = 0.3 } = options;

    try {
      const farms = await this.collection
        .find({ confidence: { $gte: minConfidence } })
        .sort({ confidence: -1 })
        .limit(limit)
        .toArray();

      return farms as unknown as BotFarmRecord[];
    } catch (error) {
      console.error('[BotFarmsService] Error getting all farms:', error);
      return [];
    }
  }

  /**
   * Store detected farms
   */
  async storeFarms(farms: BotFarmRecord[]): Promise<void> {
    if (!farms.length) return;

    const operations = farms.map(farm => ({
      updateOne: {
        filter: { farmId: farm.farmId },
        update: { $set: farm },
        upsert: true
      }
    }));

    try {
      await this.collection.bulkWrite(operations);
    } catch (error) {
      console.error('[BotFarmsService] Error storing farms:', error);
    }
  }
}
