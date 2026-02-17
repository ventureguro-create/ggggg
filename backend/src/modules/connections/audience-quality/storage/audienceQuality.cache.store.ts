/**
 * AQE Cache Store (MongoDB)
 * 
 * Caches AQE results with TTL.
 * Uses MongoDB TTL index for automatic expiration.
 */

import type { Collection, Db } from 'mongodb';
import type { AQEResult } from '../contracts/audienceQuality.types.js';

type AQECacheDoc = AQEResult & {
  _id: string; // actorId
  expiresAt: Date;
};

export class AudienceQualityCacheStore {
  private col: Collection<AQECacheDoc>;

  constructor(db: Db) {
    this.col = db.collection<AQECacheDoc>('connections_aqe_cache');
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async get(actorId: string): Promise<AQEResult | null> {
    const doc = await this.col.findOne({ _id: actorId });
    if (!doc) return null;
    
    // Strip MongoDB-only fields
    const { expiresAt, _id, ...rest } = doc as any;
    return rest as AQEResult;
  }

  async set(actorId: string, result: AQEResult): Promise<void> {
    const expiresAt = new Date(Date.now() + result.ttlSeconds * 1000);
    const doc: AQECacheDoc = { ...result, _id: actorId, expiresAt };
    await this.col.updateOne({ _id: actorId }, { $set: doc }, { upsert: true });
  }

  async clear(actorId: string): Promise<void> {
    await this.col.deleteOne({ _id: actorId });
  }

  async clearAll(): Promise<void> {
    await this.col.deleteMany({});
  }

  async getStats(): Promise<{ count: number }> {
    const count = await this.col.countDocuments({});
    return { count };
  }
}
