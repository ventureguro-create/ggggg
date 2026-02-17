/**
 * Build Series - Network v2
 * 
 * Transforms twitter_results into activity vectors per author
 * READ-ONLY from twitter_results
 */

import type { Db } from 'mongodb';
import type { AuthorActivityVector, CoEngagementConfig } from './co-engagement.types.js';

/**
 * Build activity vectors from twitter_results
 * This is READ-ONLY - we only aggregate data
 */
export async function buildActivityVectors(
  db: Db,
  cfg: CoEngagementConfig,
  opts?: { author_ids?: string[] }
): Promise<Map<string, AuthorActivityVector>> {
  const collection = db.collection('twitter_results');
  
  // Time window
  const since = new Date();
  since.setDate(since.getDate() - cfg.window_days);
  
  // Build aggregation pipeline
  const matchStage: any = {
    parsed_at: { $gte: since },
  };
  
  if (opts?.author_ids?.length) {
    matchStage['author.id'] = { $in: opts.author_ids };
  }
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$author.id',
        handle: { $first: '$author.username' },
        tweets_count: { $sum: 1 },
        
        // Engagement given (liked/replied/retweeted posts)
        liked_posts: { $push: { $cond: ['$public_metrics.like_count', '$id', null] } },
        
        // Engagement received
        total_likes: { $sum: '$public_metrics.like_count' },
        total_replies: { $sum: '$public_metrics.reply_count' },
        total_retweets: { $sum: '$public_metrics.retweet_count' },
        
        // Temporal
        hours: { $push: { $hour: '$parsed_at' } },
        days: { $push: { $dayOfWeek: '$parsed_at' } },
        
        // First/last
        first_activity: { $min: '$parsed_at' },
        last_activity: { $max: '$parsed_at' },
        
        // Mentioned/replied authors
        mentioned_ids: { $push: '$entities.mentions.id' },
        in_reply_to: { $push: '$in_reply_to_user_id' },
      },
    },
    {
      $match: {
        tweets_count: { $gte: cfg.min_tweets },
      },
    },
    { $limit: cfg.max_nodes },
  ];
  
  const results = await collection.aggregate(pipeline).toArray();
  
  const vectors = new Map<string, AuthorActivityVector>();
  
  for (const doc of results) {
    // Build hourly distribution (24 buckets)
    const hourlyActivity = new Array(24).fill(0);
    if (doc.hours) {
      for (const h of doc.hours) {
        if (typeof h === 'number' && h >= 0 && h < 24) {
          hourlyActivity[h]++;
        }
      }
    }
    
    // Build daily distribution (7 buckets)
    const dailyActivity = new Array(7).fill(0);
    if (doc.days) {
      for (const d of doc.days) {
        if (typeof d === 'number' && d >= 1 && d <= 7) {
          dailyActivity[d - 1]++;
        }
      }
    }
    
    // Build interaction maps
    const repliedToAuthors = new Map<string, number>();
    if (doc.in_reply_to) {
      for (const id of doc.in_reply_to) {
        if (id) {
          repliedToAuthors.set(String(id), (repliedToAuthors.get(String(id)) || 0) + 1);
        }
      }
    }
    
    // Mentioned authors
    const mentionedAuthors = new Map<string, number>();
    if (doc.mentioned_ids) {
      for (const ids of doc.mentioned_ids) {
        if (Array.isArray(ids)) {
          for (const id of ids) {
            if (id) {
              mentionedAuthors.set(String(id), (mentionedAuthors.get(String(id)) || 0) + 1);
            }
          }
        }
      }
    }
    
    const vector: AuthorActivityVector = {
      author_id: String(doc._id),
      handle: doc.handle || 'unknown',
      tweets_count: doc.tweets_count || 0,
      likes_given: 0, // Would need separate query
      replies_given: repliedToAuthors.size,
      retweets_given: 0,
      liked_authors: new Map(), // Would need separate data
      replied_to_authors: repliedToAuthors,
      retweeted_authors: new Map(),
      hourly_activity: hourlyActivity,
      daily_activity: dailyActivity,
      engagement_received: (doc.total_likes || 0) + (doc.total_replies || 0) + (doc.total_retweets || 0),
      elite_engagement_received: 0, // Would need elite list
      window_days: cfg.window_days,
      first_activity: doc.first_activity?.toISOString() || '',
      last_activity: doc.last_activity?.toISOString() || '',
    };
    
    vectors.set(String(doc._id), vector);
  }
  
  console.log(`[CoEngagement] Built ${vectors.size} activity vectors from ${cfg.window_days}d window`);
  return vectors;
}

console.log('[CoEngagement] Build Series module loaded');
