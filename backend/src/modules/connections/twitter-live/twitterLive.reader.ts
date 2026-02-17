/**
 * Twitter Live Reader
 * 
 * Reads live Twitter data from twitter_results.
 * NO WRITES. Freshness guard. Dedup by tweet_id.
 */

import { Db } from 'mongodb';
import { getTwitterLiveConfig } from './config.js';

const COLLECTION = 'twitter_results';

export interface LiveReadResult {
  success: boolean;
  mode: string;
  data: {
    tweets: any[];
    authors: Map<string, any>;
    total_tweets: number;
    unique_authors: number;
  };
  freshness: {
    newest?: Date;
    oldest?: Date;
    avg_age_hours: number;
    stale_count: number;
  };
  dedup: {
    total_read: number;
    after_dedup: number;
    duplicates_removed: number;
  };
  warnings: string[];
}

/**
 * Read live data with freshness guard and dedup
 */
export async function readLiveTwitterData(
  db: Db,
  options?: { limit?: number; max_age_hours?: number }
): Promise<LiveReadResult> {
  const config = getTwitterLiveConfig();
  const limit = options?.limit || 500;
  const maxAgeHours = options?.max_age_hours || config.max_age_hours;
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const result: LiveReadResult = {
    success: false,
    mode: config.mode,
    data: { tweets: [], authors: new Map(), total_tweets: 0, unique_authors: 0 },
    freshness: { avg_age_hours: 0, stale_count: 0 },
    dedup: { total_read: 0, after_dedup: 0, duplicates_removed: 0 },
    warnings: [],
  };

  if (!config.enabled || config.mode === 'off') {
    result.warnings.push('Twitter Live disabled');
    return result;
  }

  try {
    const collection = db.collection(COLLECTION);
    const seenTweetIds = new Set<string>();
    const authors = new Map<string, any>();
    const tweets: any[] = [];

    const cursor = collection.find({ createdAt: { $gte: cutoff } }).sort({ createdAt: -1 }).limit(limit * 2);
    const docs = await cursor.toArray();
    result.dedup.total_read = docs.length;

    for (const doc of docs) {
      const tweetId = doc.tweetId || String(doc._id);
      
      // Dedup
      if (seenTweetIds.has(tweetId)) {
        result.dedup.duplicates_removed++;
        continue;
      }
      seenTweetIds.add(tweetId);

      // Freshness check
      const age = (Date.now() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60);
      if (age > maxAgeHours) {
        result.freshness.stale_count++;
        continue;
      }

      tweets.push(doc);

      // Track author
      const authorId = doc.author?.id || doc.username;
      if (authorId && !authors.has(authorId)) {
        authors.set(authorId, {
          id: authorId,
          username: doc.author?.username || doc.username,
          followers: doc.author?.followers || 0,
          verified: doc.author?.verified || false,
        });
      }

      if (tweets.length >= limit) break;
    }

    result.data.tweets = tweets;
    result.data.authors = authors;
    result.data.total_tweets = tweets.length;
    result.data.unique_authors = authors.size;
    result.dedup.after_dedup = tweets.length;

    // Freshness stats
    if (tweets.length > 0) {
      const dates = tweets.map(t => new Date(t.createdAt).getTime());
      const now = Date.now();
      result.freshness = {
        newest: new Date(Math.max(...dates)),
        oldest: new Date(Math.min(...dates)),
        avg_age_hours: dates.reduce((sum, d) => sum + (now - d), 0) / dates.length / (1000 * 60 * 60),
        stale_count: result.freshness.stale_count,
      };
    }

    result.success = true;
    console.log(`[TwitterLive] Read ${result.data.total_tweets} tweets, ${result.data.unique_authors} authors`);
  } catch (err: any) {
    result.warnings.push(`Read failed: ${err.message}`);
    console.error('[TwitterLive] Error:', err.message);
  }

  return result;
}

/**
 * Check data availability
 */
export async function checkDataAvailability(db: Db): Promise<{
  available: boolean;
  tweet_count: number;
  author_count: number;
  newest_at?: Date;
}> {
  try {
    const collection = db.collection(COLLECTION);
    const count = await collection.countDocuments();
    
    if (count === 0) {
      return { available: false, tweet_count: 0, author_count: 0 };
    }

    const newest = await collection.findOne({}, { sort: { createdAt: -1 } });
    const authorCount = await collection.aggregate([
      { $group: { _id: '$author.id' } },
      { $count: 'count' }
    ]).toArray();

    return {
      available: true,
      tweet_count: count,
      author_count: authorCount[0]?.count || 0,
      newest_at: newest?.createdAt,
    };
  } catch {
    return { available: false, tweet_count: 0, author_count: 0 };
  }
}
