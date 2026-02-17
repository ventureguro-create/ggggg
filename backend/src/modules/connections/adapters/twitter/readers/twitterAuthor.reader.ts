/**
 * Twitter Author Reader
 * 
 * Reads author data from twitter_results.author via aggregation.
 * NO WRITES. READ-ONLY.
 */

import { Db } from 'mongodb';

export interface AuthorSnapshot {
  author_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  followers: number;
  verified: boolean;
  last_seen_at: Date;
  tweet_count: number;
  source: 'twitter_results';
}

export interface AuthorReadResult {
  success: boolean;
  authors: AuthorSnapshot[];
  total_count: number;
  coverage: {
    with_id: number;
    with_followers: number;
    with_verified: number;
  };
  freshness: {
    oldest?: Date;
    newest?: Date;
    avg_age_hours: number;
  };
  warnings: string[];
}

const COLLECTION = 'twitter_results';

/**
 * Read authors aggregated from twitter_results.author
 */
export async function readTwitterAuthors(
  db: Db,
  options?: {
    limit?: number;
    max_age_hours?: number;
  }
): Promise<AuthorReadResult> {
  const result: AuthorReadResult = {
    success: false,
    authors: [],
    total_count: 0,
    coverage: { with_id: 0, with_followers: 0, with_verified: 0 },
    freshness: { avg_age_hours: 0 },
    warnings: [],
  };

  const limit = options?.limit || 500;
  const maxAgeHours = options?.max_age_hours || 336; // 14 days
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  try {
    const collection = db.collection(COLLECTION);

    // Aggregation: group by author.id, get latest data
    const pipeline = [
      {
        $match: {
          'author.id': { $exists: true, $ne: null },
          createdAt: { $gte: cutoff },
        },
      },
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          display_name: { $first: '$author.name' },
          avatar_url: { $first: '$author.avatar' },
          followers: { $max: '$author.followers' },
          verified: { $first: '$author.verified' },
          last_seen_at: { $max: '$createdAt' },
          tweet_count: { $sum: 1 },
        },
      },
      { $sort: { tweet_count: -1 } },
      { $limit: limit },
    ];

    const docs = await collection.aggregate(pipeline).toArray();

    for (const doc of docs) {
      const author: AuthorSnapshot = {
        author_id: doc._id,
        username: doc.username || `user_${doc._id}`,
        display_name: doc.display_name,
        avatar_url: doc.avatar_url,
        followers: doc.followers || 0,
        verified: doc.verified || false,
        last_seen_at: doc.last_seen_at,
        tweet_count: doc.tweet_count,
        source: 'twitter_results',
      };

      result.authors.push(author);

      // Coverage stats
      if (doc._id) result.coverage.with_id++;
      if (doc.followers > 0) result.coverage.with_followers++;
      if (doc.verified) result.coverage.with_verified++;
    }

    result.total_count = result.authors.length;

    // Freshness calculation
    if (result.authors.length > 0) {
      const dates = result.authors.map((a) => a.last_seen_at.getTime());
      const now = Date.now();
      result.freshness = {
        oldest: new Date(Math.min(...dates)),
        newest: new Date(Math.max(...dates)),
        avg_age_hours: dates.reduce((sum, d) => sum + (now - d), 0) / dates.length / (1000 * 60 * 60),
      };
    }

    result.success = true;
    console.log(`[TwitterAuthorReader] Read ${result.total_count} authors from ${COLLECTION}`);
  } catch (err: any) {
    result.warnings.push(`Read failed: ${err.message}`);
    console.error('[TwitterAuthorReader] Error:', err.message);
  }

  return result;
}

/**
 * Get author by ID
 */
export async function getAuthorById(
  db: Db,
  authorId: string
): Promise<AuthorSnapshot | null> {
  try {
    const collection = db.collection(COLLECTION);

    const docs = await collection
      .aggregate([
        { $match: { 'author.id': authorId } },
        {
          $group: {
            _id: '$author.id',
            username: { $first: '$author.username' },
            display_name: { $first: '$author.name' },
            avatar_url: { $first: '$author.avatar' },
            followers: { $max: '$author.followers' },
            verified: { $first: '$author.verified' },
            last_seen_at: { $max: '$createdAt' },
            tweet_count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    if (docs.length === 0) return null;

    const doc = docs[0];
    return {
      author_id: doc._id,
      username: doc.username || `user_${doc._id}`,
      display_name: doc.display_name,
      avatar_url: doc.avatar_url,
      followers: doc.followers || 0,
      verified: doc.verified || false,
      last_seen_at: doc.last_seen_at,
      tweet_count: doc.tweet_count,
      source: 'twitter_results',
    };
  } catch (err) {
    return null;
  }
}
