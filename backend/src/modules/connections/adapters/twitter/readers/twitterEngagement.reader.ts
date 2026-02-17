/**
 * Twitter Engagement Reader
 * 
 * Reads engagement events from twitter_results.
 * Maps tweets to EngagementEvent format.
 * NO WRITES. READ-ONLY.
 */

import { Db } from 'mongodb';

export interface EngagementEvent {
  tweet_id: string;
  author_id: string;
  username: string;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  created_at: Date;
  collected_at: Date;
  source_session_id?: string;
  source_task_id?: string;
}

export interface EngagementReadResult {
  success: boolean;
  events: EngagementEvent[];
  total_count: number;
  stats: {
    total_likes: number;
    total_reposts: number;
    total_replies: number;
    total_views: number;
    avg_engagement_rate: number;
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
 * Read engagement events from twitter_results
 */
export async function readTwitterEngagements(
  db: Db,
  options?: {
    author_ids?: string[];
    limit?: number;
    max_age_hours?: number;
  }
): Promise<EngagementReadResult> {
  const result: EngagementReadResult = {
    success: false,
    events: [],
    total_count: 0,
    stats: {
      total_likes: 0,
      total_reposts: 0,
      total_replies: 0,
      total_views: 0,
      avg_engagement_rate: 0,
    },
    freshness: { avg_age_hours: 0 },
    warnings: [],
  };

  const limit = options?.limit || 1000;
  const maxAgeHours = options?.max_age_hours || 336; // 14 days
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  try {
    const collection = db.collection(COLLECTION);

    // Build query
    const query: any = { createdAt: { $gte: cutoff } };
    if (options?.author_ids && options.author_ids.length > 0) {
      query['author.id'] = { $in: options.author_ids };
    }

    const cursor = collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const docs = await cursor.toArray();

    for (const doc of docs) {
      const event: EngagementEvent = {
        tweet_id: doc.tweetId || String(doc._id),
        author_id: doc.author?.id || doc.username,
        username: doc.username || doc.author?.username || 'unknown',
        likes: doc.likes || 0,
        reposts: doc.reposts || 0,
        replies: doc.replies || 0,
        views: doc.views || 0,
        created_at: doc.tweetedAt || doc.createdAt || new Date(),
        collected_at: doc.parsedAt || doc.createdAt || new Date(),
        source_session_id: doc.sessionId,
        source_task_id: doc.taskId,
      };

      result.events.push(event);

      // Aggregate stats
      result.stats.total_likes += event.likes;
      result.stats.total_reposts += event.reposts;
      result.stats.total_replies += event.replies;
      result.stats.total_views += event.views;
    }

    result.total_count = result.events.length;

    // Calculate avg engagement rate
    if (result.stats.total_views > 0) {
      const totalEngagement = result.stats.total_likes + result.stats.total_reposts + result.stats.total_replies;
      result.stats.avg_engagement_rate = totalEngagement / result.stats.total_views;
    }

    // Freshness calculation
    if (result.events.length > 0) {
      const dates = result.events.map((e) => e.created_at.getTime());
      const now = Date.now();
      result.freshness = {
        oldest: new Date(Math.min(...dates)),
        newest: new Date(Math.max(...dates)),
        avg_age_hours: dates.reduce((sum, d) => sum + (now - d), 0) / dates.length / (1000 * 60 * 60),
      };
    }

    result.success = true;
    console.log(`[TwitterEngagementReader] Read ${result.total_count} events from ${COLLECTION}`);
  } catch (err: any) {
    result.warnings.push(`Read failed: ${err.message}`);
    console.error('[TwitterEngagementReader] Error:', err.message);
  }

  return result;
}

/**
 * Read engagements for specific author
 */
export async function readAuthorEngagements(
  db: Db,
  authorId: string,
  options?: { limit?: number; max_age_hours?: number }
): Promise<EngagementEvent[]> {
  const result = await readTwitterEngagements(db, {
    author_ids: [authorId],
    limit: options?.limit || 100,
    max_age_hours: options?.max_age_hours,
  });
  return result.events;
}

/**
 * Get engagement time series for author
 */
export async function getAuthorEngagementTimeSeries(
  db: Db,
  authorId: string,
  days: number = 14
): Promise<{ date: string; likes: number; reposts: number; replies: number; views: number }[]> {
  const collection = db.collection(COLLECTION);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const pipeline = [
      {
        $match: {
          'author.id': authorId,
          createdAt: { $gte: cutoff },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          likes: { $sum: '$likes' },
          reposts: { $sum: '$reposts' },
          replies: { $sum: '$replies' },
          views: { $sum: '$views' },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const docs = await collection.aggregate(pipeline).toArray();

    return docs.map((d) => ({
      date: d._id,
      likes: d.likes,
      reposts: d.reposts,
      replies: d.replies,
      views: d.views,
    }));
  } catch (err) {
    return [];
  }
}
