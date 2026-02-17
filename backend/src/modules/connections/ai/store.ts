/**
 * AI Summary Store (Phase 3.5)
 * MongoDB cache with TTL
 */

import crypto from 'crypto';
import type { Collection, Db } from 'mongodb';
import type { AiSummaryInput, AiSummaryOutput } from './contracts.js';

interface AiCacheDoc {
  _id: string;
  account_id: string;
  created_at: Date;
  expires_at: Date;
  input_hash: string;
  input: AiSummaryInput;
  output: AiSummaryOutput;
}

export class AiSummaryStore {
  private collection: Collection<AiCacheDoc>;
  
  constructor(db: Db) {
    this.collection = db.collection<AiCacheDoc>('connections_ai_summaries');
  }
  
  /**
   * Initialize indexes (call once on startup)
   */
  async init(): Promise<void> {
    try {
      // TTL index for automatic expiration
      await this.collection.createIndex(
        { expires_at: 1 },
        { expireAfterSeconds: 0 }
      );
      
      // Index for lookups
      await this.collection.createIndex({ account_id: 1 });
      
      console.log('[AI Store] Indexes created');
    } catch (err) {
      console.warn('[AI Store] Index creation warning:', err);
    }
  }
  
  /**
   * Hash input for cache key
   */
  static hashInput(input: AiSummaryInput): string {
    // Only hash the relevant parts for cache
    const hashable = {
      account_id: input.account_id,
      mode: input.mode,
      snapshot: input.snapshot,
      event: input.event,
    };
    const str = JSON.stringify(hashable);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 32);
  }
  
  /**
   * Get cached result
   */
  async getByHash(hash: string): Promise<AiSummaryOutput | null> {
    const doc = await this.collection.findOne({ _id: hash });
    if (!doc) return null;
    
    // Check if still valid
    if (doc.expires_at < new Date()) {
      return null;
    }
    
    return doc.output;
  }
  
  /**
   * Get by account ID (latest)
   */
  async getByAccountId(accountId: string): Promise<AiSummaryOutput | null> {
    const doc = await this.collection.findOne(
      { account_id: accountId, expires_at: { $gt: new Date() } },
      { sort: { created_at: -1 } }
    );
    return doc?.output ?? null;
  }
  
  /**
   * Store result with TTL
   */
  async put(params: {
    hash: string;
    account_id: string;
    input: AiSummaryInput;
    output: AiSummaryOutput;
    ttlSec: number;
  }): Promise<void> {
    const now = new Date();
    const expires = new Date(now.getTime() + params.ttlSec * 1000);
    
    await this.collection.updateOne(
      { _id: params.hash },
      {
        $set: {
          _id: params.hash,
          account_id: params.account_id,
          created_at: now,
          expires_at: expires,
          input_hash: params.hash,
          input: params.input,
          output: params.output,
        },
      },
      { upsert: true }
    );
  }
  
  /**
   * Get cache stats
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    by_verdict: Record<string, number>;
  }> {
    const now = new Date();
    
    const [total, active, verdicts] = await Promise.all([
      this.collection.countDocuments(),
      this.collection.countDocuments({ expires_at: { $gt: now } }),
      this.collection.aggregate([
        { $match: { expires_at: { $gt: now } } },
        { $group: { _id: '$output.verdict', count: { $sum: 1 } } },
      ]).toArray(),
    ]);
    
    const by_verdict: Record<string, number> = {};
    for (const v of verdicts) {
      by_verdict[v._id as string] = v.count;
    }
    
    return { total, active, by_verdict };
  }
  
  /**
   * Clear expired entries (manual cleanup)
   */
  async cleanup(): Promise<number> {
    const result = await this.collection.deleteMany({
      expires_at: { $lt: new Date() },
    });
    return result.deletedCount;
  }
}
