/**
 * Twitter Data Importer for Connections
 * 
 * Imports real Twitter data from parser into connections_unified_accounts
 * Uses Playwright parser data - no HTTP calls to Twitter
 */

import { Db } from 'mongodb';
import { getMongoDb } from '../../../db/mongoose.js';

const COLLECTION = 'connections_unified_accounts';
const PARSED_TWEETS = 'parsed_tweets';
const TWITTER_ACCOUNTS = 'twitter_accounts_cache';

interface TwitterAuthor {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  verified?: boolean;
  followers?: number;
}

interface ParsedTweet {
  id: string;
  text: string;
  author: TwitterAuthor;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  createdAt: string;
}

/**
 * Import Twitter accounts from parsed tweets into unified accounts
 */
export async function importTwitterAccountsFromTweets(db: Db): Promise<{ imported: number; updated: number }> {
  const tweetsCollection = db.collection(PARSED_TWEETS);
  const unifiedCollection = db.collection(COLLECTION);
  const cacheCollection = db.collection(TWITTER_ACCOUNTS);
  
  // Aggregate unique authors from parsed tweets
  const authors = await tweetsCollection.aggregate([
    { $match: { 'author.username': { $exists: true, $ne: '' } } },
    { $group: {
      _id: '$author.username',
      author: { $first: '$author' },
      tweetCount: { $sum: 1 },
      totalLikes: { $sum: '$likes' },
      totalReposts: { $sum: '$reposts' },
      totalReplies: { $sum: '$replies' },
      totalViews: { $sum: '$views' },
      lastTweetAt: { $max: '$createdAt' }
    }},
    { $sort: { tweetCount: -1 } }
  ]).toArray();
  
  let imported = 0;
  let updated = 0;
  
  for (const doc of authors) {
    const author = doc.author as TwitterAuthor;
    const username = author.username;
    
    if (!username) continue;
    
    // Calculate engagement score (0-1)
    const avgEngagement = doc.tweetCount > 0 
      ? (doc.totalLikes + doc.totalReposts * 2 + doc.totalReplies * 3) / doc.tweetCount / 1000
      : 0;
    const engagement = Math.min(avgEngagement, 1);
    
    // Calculate influence based on followers and engagement
    const followers = author.followers || 0;
    const influence = Math.min(
      (Math.log10(Math.max(followers, 1)) / 7) * 0.6 + engagement * 0.4,
      1
    );
    
    // Determine categories from tweet content
    const categories: string[] = [];
    if (doc.tweetCount >= 5) categories.push('ACTIVE');
    if (followers > 100000) categories.push('INFLUENCER');
    if (author.verified) categories.push('VERIFIED');
    
    const accountData = {
      id: `tw:${author.id || username}`,
      kind: 'TWITTER',
      title: author.name || username,
      handle: username.startsWith('@') ? username : `@${username}`,
      avatar: author.avatar,
      categories,
      tags: ['twitter', 'real'],
      followers,
      engagement: parseFloat(engagement.toFixed(3)),
      influence: parseFloat(influence.toFixed(3)),
      smart: 0.5, // Default, will be refined
      early: 0.5, // Default, will be refined
      confidence: 0.7,
      tweetCount: doc.tweetCount,
      totalEngagement: doc.totalLikes + doc.totalReposts + doc.totalReplies,
      lastActivity: doc.lastTweetAt,
      importedAt: new Date(),
      source: 'PLAYWRIGHT_PARSER'
    };
    
    // Upsert into unified accounts
    const result = await unifiedCollection.updateOne(
      { handle: accountData.handle },
      { $set: accountData },
      { upsert: true }
    );
    
    if (result.upsertedCount > 0) imported++;
    else if (result.modifiedCount > 0) updated++;
    
    // Also cache in twitter_accounts_cache
    await cacheCollection.updateOne(
      { username },
      { $set: { ...author, lastSeen: new Date() } },
      { upsert: true }
    );
  }
  
  console.log(`[TwitterImporter] Imported ${imported}, updated ${updated} accounts from ${authors.length} unique authors`);
  
  return { imported, updated };
}

/**
 * Extract token symbols ($BTC, $ETH, etc.) from tweet text
 */
function extractTokenMentions(text: string): string[] {
  if (!text) return [];
  
  // Match $SYMBOL patterns (2-10 uppercase letters/numbers after $)
  const matches = text.match(/\$[A-Z][A-Z0-9]{1,9}/g) || [];
  
  // Dedupe and filter common false positives
  const tokens = [...new Set(matches.map(t => t.toUpperCase()))];
  
  // Filter out common non-token matches
  const excludeList = ['$USD', '$EUR', '$GBP', '$JPY', '$CNY', '$AUD', '$CAD'];
  
  return tokens.filter(t => !excludeList.includes(t));
}

/**
 * Import accounts from a search result with REAL scoring and TOKEN MENTIONS
 */
export async function importFromSearchResult(tweets: ParsedTweet[], additionalCategories: string[] = []): Promise<number> {
  if (!tweets || tweets.length === 0) return 0;
  
  const db = getMongoDb();
  const collection = db.collection(COLLECTION);
  
  // Aggregate tweet data per author for scoring
  const authorStats = new Map<string, {
    author: TwitterAuthor;
    tweetCount: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
    totalViews: number;
    tokenMentions: Map<string, number>; // token -> count
    recentTweets: string[]; // last 5 tweet texts
  }>();
  
  for (const tweet of tweets) {
    if (!tweet.author?.username) continue;
    
    const username = tweet.author.username;
    const existing = authorStats.get(username);
    
    // Extract tokens from tweet text
    const tokens = extractTokenMentions(tweet.text || '');
    
    if (existing) {
      existing.tweetCount++;
      existing.totalLikes += tweet.likes || 0;
      existing.totalReposts += tweet.reposts || 0;
      existing.totalReplies += tweet.replies || 0;
      existing.totalViews += tweet.views || 0;
      // Update author with latest data (might have more info)
      if (tweet.author.followers) existing.author.followers = tweet.author.followers;
      if (tweet.author.avatar) existing.author.avatar = tweet.author.avatar;
      // Aggregate token mentions
      for (const token of tokens) {
        existing.tokenMentions.set(token, (existing.tokenMentions.get(token) || 0) + 1);
      }
      // Keep last 5 tweets
      if (existing.recentTweets.length < 5 && tweet.text) {
        existing.recentTweets.push(tweet.text);
      }
    } else {
      const tokenMap = new Map<string, number>();
      for (const token of tokens) {
        tokenMap.set(token, 1);
      }
      authorStats.set(username, {
        author: tweet.author,
        tweetCount: 1,
        totalLikes: tweet.likes || 0,
        totalReposts: tweet.reposts || 0,
        totalReplies: tweet.replies || 0,
        totalViews: tweet.views || 0,
        tokenMentions: tokenMap,
        recentTweets: tweet.text ? [tweet.text] : [],
      });
    }
  }
  
  let count = 0;
  
  for (const [username, stats] of authorStats) {
    const { author, tweetCount, totalLikes, totalReposts, totalReplies, totalViews, tokenMentions, recentTweets } = stats;
    const handle = username.startsWith('@') ? username : `@${username}`;
    const followers = author.followers || 0;
    
    // === IMPROVED SCORING FORMULAS ===
    
    // 1. INFLUENCE SCORE (0-1) - based on followers with logarithmic scale
    // 1K = 0.43, 10K = 0.57, 100K = 0.71, 1M = 0.86, 100M = 1.14 (capped at 1)
    const influenceRaw = followers > 0 ? Math.log10(followers) / 7 : 0;
    const influence = Math.min(Math.max(influenceRaw, 0), 1);
    
    // 2. ENGAGEMENT METRICS - real calculations
    const totalEngagement = totalLikes + totalReposts * 2 + totalReplies * 3;
    const avgEngagementPerTweet = tweetCount > 0 ? totalEngagement / tweetCount : 0;
    
    // Engagement rate as percentage (avgEngagement / followers * 100)
    // For mega accounts (>10M), even 0.01% is good engagement
    const engagementRateRaw = followers > 0 ? (avgEngagementPerTweet / followers) * 100 : 0;
    
    // Normalized engagement score (0-1) adjusted for account size
    // Small accounts: 5% engagement = 1.0
    // Large accounts (>1M): 0.1% engagement = 1.0 (proportionally harder)
    let engagementNormalized = 0;
    if (followers > 10000000) {
      // Mega accounts (>10M): 0.05% = good
      engagementNormalized = Math.min(engagementRateRaw / 0.05, 1);
    } else if (followers > 1000000) {
      // Large accounts (1M-10M): 0.1% = good
      engagementNormalized = Math.min(engagementRateRaw / 0.1, 1);
    } else if (followers > 100000) {
      // Medium accounts (100K-1M): 0.5% = good
      engagementNormalized = Math.min(engagementRateRaw / 0.5, 1);
    } else if (followers > 10000) {
      // Small accounts (10K-100K): 2% = good
      engagementNormalized = Math.min(engagementRateRaw / 2, 1);
    } else {
      // Micro accounts (<10K): 5% = good
      engagementNormalized = Math.min(engagementRateRaw / 5, 1);
    }
    
    // If no engagement data, estimate from verified status
    if (engagementNormalized === 0 && engagementRateRaw === 0) {
      engagementNormalized = author.verified ? 0.6 : 0.4;
    }
    
    // 3. TWITTER SCORE (0-1000) - Primary metric combining multiple factors
    // Formula: (Influence × 0.4) + (Engagement × 0.3) + (Activity × 0.15) + (Verified × 0.15)
    const activityScore = tweetCount >= 10 ? 1 : tweetCount >= 5 ? 0.7 : tweetCount >= 2 ? 0.5 : 0.3;
    const verifiedBonus = author.verified ? 1 : 0;
    const twitterScoreRaw = influence * 0.4 + engagementNormalized * 0.3 + activityScore * 0.15 + verifiedBonus * 0.15;
    const twitterScore = Math.round(twitterScoreRaw * 1000);
    
    // 4. SMART SCORE (0-1) - Quality indicator
    const smart = influence * 0.5 + (author.verified ? 0.3 : 0) + engagementNormalized * 0.2;
    
    // 5. EARLY SCORE (0-1) - Activity indicator
    const early = tweetCount >= 5 ? 0.8 : tweetCount >= 2 ? 0.6 : 0.4;
    
    // 6. NETWORK SCORE (0-100) - Connection quality estimate
    // Based on influence + engagement combination
    const networkScore = Math.round((influence * 0.6 + engagementNormalized * 0.4) * 100);
    
    // 7. CONFIDENCE (0-1) - Data completeness
    let confidenceFactors = 0;
    if (followers > 0) confidenceFactors++;
    if (author.avatar) confidenceFactors++;
    if (author.verified !== undefined) confidenceFactors++;
    if (tweetCount >= 2) confidenceFactors++;
    if (totalViews > 0 || totalLikes > 0) confidenceFactors++;
    const confidence = 0.4 + (confidenceFactors / 5) * 0.5;
    
    // 8. CATEGORIES based on metrics
    const categories: string[] = [...additionalCategories]; // Start with additional categories
    if (followers >= 100000) categories.push('INFLUENCER');
    else if (followers >= 10000) categories.push('POPULAR');
    if (engagementNormalized >= 0.7) categories.push('HIGH_ENGAGEMENT');
    if (author.verified) categories.push('VERIFIED');
    if (tweetCount >= 5) categories.push('ACTIVE');
    
    // 9. Calculate avgLikes for display
    const avgLikes = tweetCount > 0 ? Math.round(totalLikes / tweetCount) : 0;
    
    const result = await collection.updateOne(
      { handle },
      { 
        $set: {
          id: `tw:${author.id || username}`,
          kind: 'TWITTER',
          title: author.name || username,
          handle,
          avatar: author.avatar,
          followers,
          verified: author.verified || false,
          // Scores (0-1 range)
          influence: parseFloat(influence.toFixed(3)),
          engagement: parseFloat(engagementNormalized.toFixed(3)),
          smart: parseFloat(smart.toFixed(3)),
          early: parseFloat(early.toFixed(3)),
          confidence: parseFloat(confidence.toFixed(3)),
          // Display scores
          twitterScore,
          networkScore,
          // Activity metrics
          tweetCount,
          totalEngagement,
          avgEngagementPerTweet: parseFloat(avgEngagementPerTweet.toFixed(1)),
          engagementRate: parseFloat(engagementRateRaw.toFixed(4)), // as percentage
          avgLikes,
          totalLikes,
          totalReposts,
          totalReplies,
          totalViews,
          // Timestamps
          lastActive: new Date(),
          categories,
          lastSeen: new Date(),
          source: 'PLAYWRIGHT_PARSER'
        },
        $setOnInsert: {
          tags: ['twitter', 'real'],
          importedAt: new Date(),
          following: 0 // Will be enriched later
        },
        // Add token mentions as array (merge with existing)
        $addToSet: tokenMentions.size > 0 ? {
          recentTokens: { $each: Array.from(tokenMentions.keys()) }
        } : {}
      },
      { upsert: true }
    );
    
    // Also store token mention counts separately for ranking
    if (tokenMentions.size > 0) {
      const tokenMentionUpdates: Record<string, number> = {};
      for (const [token, count] of tokenMentions) {
        tokenMentionUpdates[`tokenMentionCounts.${token}`] = count;
      }
      await collection.updateOne(
        { handle },
        { 
          $inc: tokenMentionUpdates,
          $set: { 
            recentTweetsText: recentTweets.slice(0, 3),
            lastTokenScan: new Date()
          }
        }
      );
    }
    
    if (result.upsertedCount > 0 || result.modifiedCount > 0) count++;
  }
  
  console.log(`[TwitterImporter] Imported ${count} accounts with real scores from ${tweets.length} tweets`);
  
  return count;
}

/**
 * Get statistics about imported accounts
 */
export async function getImportStats(db: Db) {
  const collection = db.collection(COLLECTION);
  
  const stats = await collection.aggregate([
    { $facet: {
      total: [{ $count: 'count' }],
      bySource: [
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ],
      byKind: [
        { $group: { _id: '$kind', count: { $sum: 1 } } }
      ],
      recentImports: [
        { $match: { importedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        { $count: 'count' }
      ]
    }}
  ]).toArray();
  
  return {
    total: stats[0]?.total[0]?.count || 0,
    bySource: stats[0]?.bySource || [],
    byKind: stats[0]?.byKind || [],
    last24h: stats[0]?.recentImports[0]?.count || 0
  };
}
