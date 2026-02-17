/**
 * Twitter Co-Engagement Reader
 * 
 * Reads engagement patterns for similarity analysis.
 * READ-ONLY from twitter_results.
 */

import { Db } from 'mongodb';

export interface EngagementVector {
  author_id: string;
  username: string;
  tweet_count: number;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  like_rate: number;      // likes / views
  repost_rate: number;    // reposts / likes
  reply_rate: number;     // replies / likes
  engagement_rate: number; // total engagement / views
}

export interface CoEngagementReadResult {
  success: boolean;
  vectors: EngagementVector[];
  stats: {
    total_authors: number;
    avg_engagement_rate: number;
    min_tweets_threshold: number;
  };
  warnings: string[];
}

const MIN_TWEETS = 5;

/**
 * Read engagement vectors for all qualifying authors
 */
export async function readCoEngagementVectors(
  db: Db,
  options?: { min_tweets?: number; max_authors?: number }
): Promise<CoEngagementReadResult> {
  const minTweets = options?.min_tweets || MIN_TWEETS;
  const maxAuthors = options?.max_authors || 100;

  const result: CoEngagementReadResult = {
    success: false,
    vectors: [],
    stats: { total_authors: 0, avg_engagement_rate: 0, min_tweets_threshold: minTweets },
    warnings: [],
  };

  try {
    const collection = db.collection('twitter_results');

    const pipeline = [
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          tweet_count: { $sum: 1 },
          likes: { $sum: '$likes' },
          reposts: { $sum: '$reposts' },
          replies: { $sum: '$replies' },
          views: { $sum: '$views' },
        },
      },
      { $match: { tweet_count: { $gte: minTweets } } },
      { $sort: { tweet_count: -1 } },
      { $limit: maxAuthors },
    ];

    const docs = await collection.aggregate(pipeline).toArray();

    for (const doc of docs) {
      const totalEng = doc.likes + doc.reposts + doc.replies;
      
      result.vectors.push({
        author_id: doc._id,
        username: doc.username,
        tweet_count: doc.tweet_count,
        likes: doc.likes,
        reposts: doc.reposts,
        replies: doc.replies,
        views: doc.views,
        like_rate: doc.views > 0 ? doc.likes / doc.views : 0,
        repost_rate: doc.likes > 0 ? doc.reposts / doc.likes : 0,
        reply_rate: doc.likes > 0 ? doc.replies / doc.likes : 0,
        engagement_rate: doc.views > 0 ? totalEng / doc.views : 0,
      });
    }

    result.stats.total_authors = result.vectors.length;
    result.stats.avg_engagement_rate = result.vectors.length > 0
      ? result.vectors.reduce((s, v) => s + v.engagement_rate, 0) / result.vectors.length
      : 0;

    result.success = true;
    console.log(`[CoEngagementReader] Read ${result.vectors.length} vectors`);
  } catch (err: any) {
    result.warnings.push(`Read failed: ${err.message}`);
    console.error('[CoEngagementReader] Error:', err.message);
  }

  return result;
}
