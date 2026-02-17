/**
 * Co-Engagement Graph Builder
 * 
 * Builds graph edges based on shared engagement patterns,
 * NOT follow relationships (which we don't have).
 * 
 * Edge = authors who get engaged by similar audiences
 */

import { Db } from 'mongodb';

export interface CoEngagementEdge {
  from_id: string;
  to_id: string;
  from_username: string;
  to_username: string;
  weight: number;           // 0-1 correlation strength
  shared_patterns: number;  // Count of shared engagement signals
  confidence: number;       // Edge confidence
  source: 'co_engagement';
  discovered_at: Date;
}

export interface CoEngagementGraphResult {
  success: boolean;
  edges: CoEngagementEdge[];
  stats: {
    total_edges: number;
    authors_connected: number;
    avg_weight: number;
    high_confidence_edges: number;
  };
  warnings: string[];
}

const MIN_WEIGHT_THRESHOLD = 0.3;  // Minimum correlation to create edge
const MIN_TWEETS_FOR_PATTERN = 5;   // Minimum tweets to analyze pattern

/**
 * Build co-engagement graph from twitter_results
 * 
 * Logic: Authors with similar engagement patterns (likes/reposts ratios)
 * likely share similar audiences → implicit connection
 */
export async function buildCoEngagementGraph(
  db: Db,
  options?: { max_edges?: number; min_tweets?: number }
): Promise<CoEngagementGraphResult> {
  const maxEdges = options?.max_edges || 100;
  const minTweets = options?.min_tweets || MIN_TWEETS_FOR_PATTERN;

  const result: CoEngagementGraphResult = {
    success: false,
    edges: [],
    stats: { total_edges: 0, authors_connected: 0, avg_weight: 0, high_confidence_edges: 0 },
    warnings: [],
  };

  try {
    const collection = db.collection('twitter_results');

    // Get author engagement patterns
    const authorPatterns = await collection.aggregate([
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          tweet_count: { $sum: 1 },
          total_likes: { $sum: '$likes' },
          total_reposts: { $sum: '$reposts' },
          total_replies: { $sum: '$replies' },
          total_views: { $sum: '$views' },
        }
      },
      { $match: { tweet_count: { $gte: minTweets } } },
      {
        $addFields: {
          engagement_rate: {
            $cond: [
              { $gt: ['$total_views', 0] },
              { $divide: [{ $add: ['$total_likes', '$total_reposts', '$total_replies'] }, '$total_views'] },
              0
            ]
          },
          repost_ratio: {
            $cond: [
              { $gt: ['$total_likes', 0] },
              { $divide: ['$total_reposts', '$total_likes'] },
              0
            ]
          },
          reply_ratio: {
            $cond: [
              { $gt: ['$total_likes', 0] },
              { $divide: ['$total_replies', '$total_likes'] },
              0
            ]
          },
        }
      }
    ]).toArray();

    if (authorPatterns.length < 2) {
      result.warnings.push('Not enough authors with sufficient tweets');
      result.success = true;
      return result;
    }

    // Calculate pairwise similarity
    const edges: CoEngagementEdge[] = [];
    const connectedAuthors = new Set<string>();

    for (let i = 0; i < authorPatterns.length; i++) {
      for (let j = i + 1; j < authorPatterns.length; j++) {
        const a1 = authorPatterns[i];
        const a2 = authorPatterns[j];

        // Calculate pattern similarity (normalized)
        const engDiff = Math.abs(a1.engagement_rate - a2.engagement_rate);
        const repostDiff = Math.abs(a1.repost_ratio - a2.repost_ratio);
        const replyDiff = Math.abs(a1.reply_ratio - a2.reply_ratio);

        // Similarity = 1 - average difference (capped 0-1)
        const avgDiff = (engDiff + repostDiff + replyDiff) / 3;
        const similarity = Math.max(0, 1 - avgDiff * 2); // Scale factor

        if (similarity >= MIN_WEIGHT_THRESHOLD) {
          // Calculate shared patterns count (rough heuristic)
          const sharedPatterns = Math.floor(similarity * 10);
          
          // Confidence based on data volume
          const dataConfidence = Math.min(1, (a1.tweet_count + a2.tweet_count) / 100);
          const edgeConfidence = similarity * dataConfidence * 0.75; // Cap at 0.75 (no graph)

          edges.push({
            from_id: a1._id,
            to_id: a2._id,
            from_username: a1.username,
            to_username: a2.username,
            weight: similarity,
            shared_patterns: sharedPatterns,
            confidence: edgeConfidence,
            source: 'co_engagement',
            discovered_at: new Date(),
          });

          connectedAuthors.add(a1._id);
          connectedAuthors.add(a2._id);
        }
      }
    }

    // Sort by weight and limit
    edges.sort((a, b) => b.weight - a.weight);
    result.edges = edges.slice(0, maxEdges);

    // Calculate stats
    result.stats.total_edges = result.edges.length;
    result.stats.authors_connected = connectedAuthors.size;
    result.stats.avg_weight = result.edges.length > 0
      ? result.edges.reduce((sum, e) => sum + e.weight, 0) / result.edges.length
      : 0;
    result.stats.high_confidence_edges = result.edges.filter(e => e.confidence >= 0.5).length;

    result.success = true;
    console.log(`[CoEngagement] Built ${result.stats.total_edges} edges connecting ${result.stats.authors_connected} authors`);
  } catch (err: any) {
    result.warnings.push(`Build failed: ${err.message}`);
    console.error('[CoEngagement] Error:', err.message);
  }

  return result;
}

/**
 * Get graph overlay status
 */
export function getGraphOverlayStatus(): {
  mock: boolean;
  live_follow: boolean;
  live_co_engagement: boolean;
  active_source: string;
} {
  return {
    mock: true,                    // Mock graph always available
    live_follow: false,            // Follow graph not available
    live_co_engagement: true,      // Co-engagement graph available
    active_source: 'mock + co_engagement',
  };
}
