/**
 * Time Series Seed Generator
 * 
 * Generates realistic mock historical data for:
 * - Followers (growth patterns)
 * - Engagement (activity patterns)
 * - Scores (evolution patterns)
 */

import { 
  TSFollowersModel, 
  TSEngagementModel, 
  TSScoresModel,
  GradeType,
  EarlySignalBadge
} from './models.js';

export type SeedType = 'growing' | 'flat' | 'volatile' | 'declining' | 'breakout';

interface SeedOptions {
  account_id: string;
  days: number;
  seed_type: SeedType;
  base_followers?: number;
  base_score?: number;
}

/**
 * Get grade from score
 */
function getGrade(score: number): GradeType {
  if (score >= 850) return 'S';
  if (score >= 700) return 'A';
  if (score >= 550) return 'B';
  if (score >= 400) return 'C';
  return 'D';
}

/**
 * Get early signal badge based on acceleration and velocity
 */
function getEarlySignalBadge(velocity: number, acceleration: number): EarlySignalBadge {
  if (acceleration > 0.4 && velocity > 0.3) return 'breakout';
  if (velocity > 0.2 && acceleration > 0.1) return 'rising';
  return 'none';
}

/**
 * Generate random variation
 */
function randomVariation(base: number, percent: number): number {
  const variation = base * (percent / 100);
  return base + (Math.random() - 0.5) * 2 * variation;
}

/**
 * Generate follower growth pattern
 */
function generateFollowerPattern(days: number, type: SeedType, baseFollowers: number): number[] {
  const followers: number[] = [];
  let current = baseFollowers;
  
  for (let i = 0; i < days; i++) {
    switch (type) {
      case 'growing':
        // Steady growth 0.5-2% per day
        current *= 1 + (0.005 + Math.random() * 0.015);
        break;
      case 'breakout':
        // Exponential growth especially in last 10 days
        if (i > days - 10) {
          current *= 1 + (0.02 + Math.random() * 0.04);
        } else {
          current *= 1 + (0.005 + Math.random() * 0.01);
        }
        break;
      case 'flat':
        // Minimal change ±0.5%
        current *= 1 + (Math.random() - 0.5) * 0.01;
        break;
      case 'volatile':
        // Large swings ±5%
        current *= 1 + (Math.random() - 0.5) * 0.1;
        break;
      case 'declining':
        // Gradual decline 0.3-1.5% per day
        current *= 1 - (0.003 + Math.random() * 0.012);
        break;
    }
    followers.push(Math.round(current));
  }
  
  return followers;
}

/**
 * Generate engagement pattern
 */
function generateEngagementPattern(
  days: number, 
  type: SeedType, 
  baseFollowers: number
): Array<{
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  views: number;
  posts_count: number;
  engagement_rate: number;
}> {
  const engagement: Array<any> = [];
  
  // Base engagement rates by type
  const baseER = {
    growing: 0.045,
    breakout: 0.065,
    flat: 0.025,
    volatile: 0.04,
    declining: 0.015,
  };
  
  const er = baseER[type];
  
  for (let i = 0; i < days; i++) {
    const dayFollowers = baseFollowers * (1 + (i / days) * 0.3);
    const postsCount = Math.floor(2 + Math.random() * 8);
    
    // Base engagement per post
    const totalViews = Math.round(dayFollowers * (0.1 + Math.random() * 0.3) * postsCount);
    const baseLikes = Math.round(totalViews * er * randomVariation(1, 30));
    const baseReposts = Math.round(baseLikes * (0.15 + Math.random() * 0.15));
    const baseReplies = Math.round(baseLikes * (0.08 + Math.random() * 0.08));
    const baseQuotes = Math.round(baseLikes * (0.02 + Math.random() * 0.03));
    
    // Add volatility for volatile type
    const volatilityMultiplier = type === 'volatile' 
      ? (0.5 + Math.random() * 1.5) 
      : (0.85 + Math.random() * 0.3);
    
    engagement.push({
      likes: Math.round(baseLikes * volatilityMultiplier),
      reposts: Math.round(baseReposts * volatilityMultiplier),
      replies: Math.round(baseReplies * volatilityMultiplier),
      quotes: Math.round(baseQuotes * volatilityMultiplier),
      views: Math.round(totalViews * volatilityMultiplier),
      posts_count: postsCount,
      engagement_rate: Number((er * volatilityMultiplier).toFixed(4)),
    });
  }
  
  return engagement;
}

/**
 * Generate score evolution pattern
 */
function generateScorePattern(
  days: number,
  type: SeedType,
  baseScore: number
): Array<{
  twitter_score: number;
  grade: GradeType;
  components: {
    influence: number;
    quality: number;
    trend: number;
    network: number;
    consistency: number;
  };
  network_sub: {
    audience_quality: number;
    authority_proximity: number;
  };
  early_signal: {
    badge: EarlySignalBadge;
    score: number;
  };
}> {
  const scores: Array<any> = [];
  let currentScore = baseScore;
  let velocity = 0;
  let acceleration = 0;
  
  for (let i = 0; i < days; i++) {
    // Update score based on type
    switch (type) {
      case 'growing':
        velocity = 0.15 + Math.random() * 0.15;
        acceleration = 0.05 + Math.random() * 0.1;
        currentScore += randomVariation(8, 50);
        break;
      case 'breakout':
        if (i > days - 10) {
          velocity = 0.4 + Math.random() * 0.3;
          acceleration = 0.5 + Math.random() * 0.3;
          currentScore += randomVariation(25, 40);
        } else {
          velocity = 0.1 + Math.random() * 0.1;
          acceleration = 0.1 + Math.random() * 0.15;
          currentScore += randomVariation(5, 50);
        }
        break;
      case 'flat':
        velocity = -0.05 + Math.random() * 0.1;
        acceleration = -0.05 + Math.random() * 0.1;
        currentScore += randomVariation(0, 30);
        break;
      case 'volatile':
        velocity = -0.3 + Math.random() * 0.6;
        acceleration = -0.4 + Math.random() * 0.8;
        currentScore += randomVariation(0, 80);
        break;
      case 'declining':
        velocity = -0.25 + Math.random() * 0.1;
        acceleration = -0.15 + Math.random() * 0.1;
        currentScore -= randomVariation(5, 40);
        break;
    }
    
    // Clamp score
    currentScore = Math.max(100, Math.min(950, currentScore));
    
    // Generate components (normalized 0-1)
    const influence = 0.3 + Math.random() * 0.6;
    const quality = 0.4 + Math.random() * 0.5;
    const trend = Math.max(0, Math.min(1, 0.5 + velocity));
    const network = 0.3 + Math.random() * 0.5;
    const consistency = 0.4 + Math.random() * 0.4;
    
    scores.push({
      twitter_score: Math.round(currentScore),
      grade: getGrade(currentScore),
      components: {
        influence: Number(influence.toFixed(3)),
        quality: Number(quality.toFixed(3)),
        trend: Number(trend.toFixed(3)),
        network: Number(network.toFixed(3)),
        consistency: Number(consistency.toFixed(3)),
      },
      network_sub: {
        audience_quality: Number((0.4 + Math.random() * 0.5).toFixed(3)),
        authority_proximity: Number((0.2 + Math.random() * 0.6).toFixed(3)),
      },
      early_signal: {
        badge: getEarlySignalBadge(velocity, acceleration),
        score: Number((velocity * 50 + acceleration * 50).toFixed(1)),
      },
    });
  }
  
  return scores;
}

/**
 * Seed time series data for an account
 */
export async function seedTimeSeries(options: SeedOptions): Promise<{
  followers_count: number;
  engagement_count: number;
  scores_count: number;
}> {
  const { 
    account_id, 
    days, 
    seed_type,
    base_followers = 10000 + Math.random() * 90000,
    base_score = 400 + Math.random() * 300,
  } = options;
  
  // Generate patterns
  const followersPattern = generateFollowerPattern(days, seed_type, base_followers);
  const engagementPattern = generateEngagementPattern(days, seed_type, base_followers);
  const scoresPattern = generateScorePattern(days, seed_type, base_score);
  
  // Calculate timestamps (going back from now)
  const now = new Date();
  const timestamps = Array.from({ length: days }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - i));
    date.setHours(12, 0, 0, 0); // Normalize to noon
    return date;
  });
  
  // Delete existing data for this account
  await Promise.all([
    TSFollowersModel.deleteMany({ account_id }),
    TSEngagementModel.deleteMany({ account_id }),
    TSScoresModel.deleteMany({ account_id }),
  ]);
  
  // Insert followers data
  const followersData = timestamps.map((ts, i) => ({
    account_id,
    ts,
    followers: followersPattern[i],
    delta_1d: i > 0 ? followersPattern[i] - followersPattern[i - 1] : 0,
    delta_7d: i > 6 ? followersPattern[i] - followersPattern[i - 7] : undefined,
    source: 'mock' as const,
  }));
  
  // Insert engagement data
  const engagementData = timestamps.map((ts, i) => ({
    account_id,
    ts,
    ...engagementPattern[i],
    source: 'mock' as const,
  }));
  
  // Insert scores data
  const scoresData = timestamps.map((ts, i) => ({
    account_id,
    ts,
    ...scoresPattern[i],
    source: 'mock' as const,
  }));
  
  await Promise.all([
    TSFollowersModel.insertMany(followersData),
    TSEngagementModel.insertMany(engagementData),
    TSScoresModel.insertMany(scoresData),
  ]);
  
  return {
    followers_count: followersData.length,
    engagement_count: engagementData.length,
    scores_count: scoresData.length,
  };
}

/**
 * Append single data point (for future Twitter integration)
 */
export async function appendTimeSeriesPoint(data: {
  account_id: string;
  followers?: number;
  engagement?: {
    likes: number;
    reposts: number;
    replies: number;
    quotes?: number;
    views?: number;
    posts_count?: number;
  };
  score_snapshot?: {
    twitter_score: number;
    components?: any;
    network_sub?: any;
    early_signal?: any;
  };
  source: 'mock' | 'twitter';
}): Promise<void> {
  const ts = new Date();
  
  const operations: Promise<any>[] = [];
  
  if (data.followers !== undefined) {
    // Get previous point for delta calculation
    const prev = await TSFollowersModel.findOne({ account_id: data.account_id })
      .sort({ ts: -1 })
      .lean();
    
    operations.push(
      TSFollowersModel.create({
        account_id: data.account_id,
        ts,
        followers: data.followers,
        delta_1d: prev ? data.followers - prev.followers : 0,
        source: data.source,
      })
    );
  }
  
  if (data.engagement) {
    const totalEngagement = data.engagement.likes + data.engagement.reposts + 
                           data.engagement.replies + (data.engagement.quotes || 0);
    const er = data.engagement.views ? totalEngagement / data.engagement.views : 0;
    
    operations.push(
      TSEngagementModel.create({
        account_id: data.account_id,
        ts,
        ...data.engagement,
        engagement_rate: Number(er.toFixed(4)),
        source: data.source,
      })
    );
  }
  
  if (data.score_snapshot) {
    operations.push(
      TSScoresModel.create({
        account_id: data.account_id,
        ts,
        twitter_score: data.score_snapshot.twitter_score,
        grade: getGrade(data.score_snapshot.twitter_score),
        components: data.score_snapshot.components || {
          influence: 0, quality: 0, trend: 0, network: 0, consistency: 0
        },
        network_sub: data.score_snapshot.network_sub || {
          audience_quality: 0, authority_proximity: 0
        },
        early_signal: data.score_snapshot.early_signal || {
          badge: 'none', score: 0
        },
        source: data.source,
      })
    );
  }
  
  await Promise.all(operations);
}

/**
 * Batch seed multiple accounts with random patterns
 */
export async function batchSeedAccounts(
  count: number = 10,
  days: number = 30
): Promise<{ accounts_seeded: number; total_points: number }> {
  const seedTypes: SeedType[] = ['growing', 'flat', 'volatile', 'declining', 'breakout'];
  let totalPoints = 0;
  
  for (let i = 0; i < count; i++) {
    const accountId = `seed_account_${String(i + 1).padStart(3, '0')}`;
    const seedType = seedTypes[Math.floor(Math.random() * seedTypes.length)];
    
    const result = await seedTimeSeries({
      account_id: accountId,
      days,
      seed_type: seedType,
      base_followers: 5000 + Math.random() * 200000,
      base_score: 300 + Math.random() * 400,
    });
    
    totalPoints += result.followers_count + result.engagement_count + result.scores_count;
  }
  
  return { accounts_seeded: count, total_points: totalPoints };
}
