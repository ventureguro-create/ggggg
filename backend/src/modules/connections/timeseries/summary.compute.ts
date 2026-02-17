/**
 * Time Series Summary Computation
 * 
 * Computes aggregated metrics from time series data:
 * - Follower growth rates
 * - Average engagement
 * - Score velocity/acceleration
 * - Peaks and valleys
 */

import { TSFollowersModel, TSEngagementModel, TSScoresModel } from './models.js';

export interface TimeSeriesSummary {
  account_id: string;
  window_days: number;
  
  followers: {
    current: number;
    start: number;
    growth_percent: number;
    avg_daily_growth: number;
    max_spike_day: string | null;
    max_spike_value: number;
    drop_detected: boolean;
    max_drop_day: string | null;
    max_drop_value: number;
  };
  
  engagement: {
    avg_likes: number;
    avg_reposts: number;
    avg_replies: number;
    avg_views: number;
    avg_posts_per_day: number;
    avg_engagement_rate: number;
    volatility: 'low' | 'medium' | 'high';
    best_day: string | null;
    worst_day: string | null;
  };
  
  scores: {
    current: number;
    start: number;
    grade_current: string;
    grade_start: string;
    velocity: number;
    acceleration: number;
    peak: { date: string; value: number } | null;
    valley: { date: string; value: number } | null;
    trend_direction: 'up' | 'down' | 'stable';
    early_signals_count: number;
    breakouts_count: number;
  };
}

/**
 * Parse window string to days
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)d?$/);
  return match ? parseInt(match[1]) : 30;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Compute time series summary for an account
 */
export async function computeTimeSeriesSummary(
  account_id: string,
  window: string = '30d'
): Promise<TimeSeriesSummary | null> {
  const days = parseWindow(window);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Fetch all data
  const [followers, engagement, scores] = await Promise.all([
    TSFollowersModel.find({ 
      account_id, 
      ts: { $gte: startDate } 
    }).sort({ ts: 1 }).lean(),
    
    TSEngagementModel.find({ 
      account_id, 
      ts: { $gte: startDate } 
    }).sort({ ts: 1 }).lean(),
    
    TSScoresModel.find({ 
      account_id, 
      ts: { $gte: startDate } 
    }).sort({ ts: 1 }).lean(),
  ]);
  
  if (followers.length === 0 && engagement.length === 0 && scores.length === 0) {
    return null;
  }
  
  // ============================================================
  // FOLLOWERS SUMMARY
  // ============================================================
  
  let followersSummary: TimeSeriesSummary['followers'] = {
    current: 0,
    start: 0,
    growth_percent: 0,
    avg_daily_growth: 0,
    max_spike_day: null,
    max_spike_value: 0,
    drop_detected: false,
    max_drop_day: null,
    max_drop_value: 0,
  };
  
  if (followers.length > 0) {
    const first = followers[0];
    const last = followers[followers.length - 1];
    const growthPercent = first.followers > 0 
      ? ((last.followers - first.followers) / first.followers) * 100 
      : 0;
    
    // Find max spike and drop
    let maxSpike = { day: '', value: 0 };
    let maxDrop = { day: '', value: 0 };
    
    for (const point of followers) {
      if (point.delta_1d !== undefined) {
        if (point.delta_1d > maxSpike.value) {
          maxSpike = { 
            day: point.ts.toISOString().split('T')[0], 
            value: point.delta_1d 
          };
        }
        if (point.delta_1d < maxDrop.value) {
          maxDrop = { 
            day: point.ts.toISOString().split('T')[0], 
            value: point.delta_1d 
          };
        }
      }
    }
    
    followersSummary = {
      current: last.followers,
      start: first.followers,
      growth_percent: Number(growthPercent.toFixed(2)),
      avg_daily_growth: Number((growthPercent / Math.max(1, followers.length - 1)).toFixed(3)),
      max_spike_day: maxSpike.value > 0 ? maxSpike.day : null,
      max_spike_value: maxSpike.value,
      drop_detected: maxDrop.value < -100,
      max_drop_day: maxDrop.value < 0 ? maxDrop.day : null,
      max_drop_value: maxDrop.value,
    };
  }
  
  // ============================================================
  // ENGAGEMENT SUMMARY
  // ============================================================
  
  let engagementSummary: TimeSeriesSummary['engagement'] = {
    avg_likes: 0,
    avg_reposts: 0,
    avg_replies: 0,
    avg_views: 0,
    avg_posts_per_day: 0,
    avg_engagement_rate: 0,
    volatility: 'low',
    best_day: null,
    worst_day: null,
  };
  
  if (engagement.length > 0) {
    const totalLikes = engagement.reduce((sum, e) => sum + e.likes, 0);
    const totalReposts = engagement.reduce((sum, e) => sum + e.reposts, 0);
    const totalReplies = engagement.reduce((sum, e) => sum + e.replies, 0);
    const totalViews = engagement.reduce((sum, e) => sum + (e.views || 0), 0);
    const totalPosts = engagement.reduce((sum, e) => sum + e.posts_count, 0);
    const avgER = engagement.reduce((sum, e) => sum + (e.engagement_rate || 0), 0) / engagement.length;
    
    // Calculate volatility
    const erValues = engagement.map(e => e.engagement_rate || 0);
    const erStdDev = calculateStdDev(erValues);
    const erMean = avgER;
    const cv = erMean > 0 ? erStdDev / erMean : 0;
    
    let volatility: 'low' | 'medium' | 'high' = 'low';
    if (cv > 0.5) volatility = 'high';
    else if (cv > 0.25) volatility = 'medium';
    
    // Find best and worst days
    let bestDay = { day: '', likes: 0 };
    let worstDay = { day: '', likes: Infinity };
    
    for (const point of engagement) {
      if (point.likes > bestDay.likes) {
        bestDay = { day: point.ts.toISOString().split('T')[0], likes: point.likes };
      }
      if (point.likes < worstDay.likes) {
        worstDay = { day: point.ts.toISOString().split('T')[0], likes: point.likes };
      }
    }
    
    engagementSummary = {
      avg_likes: Math.round(totalLikes / engagement.length),
      avg_reposts: Math.round(totalReposts / engagement.length),
      avg_replies: Math.round(totalReplies / engagement.length),
      avg_views: Math.round(totalViews / engagement.length),
      avg_posts_per_day: Number((totalPosts / engagement.length).toFixed(1)),
      avg_engagement_rate: Number(avgER.toFixed(4)),
      volatility,
      best_day: bestDay.likes > 0 ? bestDay.day : null,
      worst_day: worstDay.likes < Infinity ? worstDay.day : null,
    };
  }
  
  // ============================================================
  // SCORES SUMMARY
  // ============================================================
  
  let scoresSummary: TimeSeriesSummary['scores'] = {
    current: 0,
    start: 0,
    grade_current: 'D',
    grade_start: 'D',
    velocity: 0,
    acceleration: 0,
    peak: null,
    valley: null,
    trend_direction: 'stable',
    early_signals_count: 0,
    breakouts_count: 0,
  };
  
  if (scores.length > 1) {
    const first = scores[0];
    const last = scores[scores.length - 1];
    
    // Calculate velocity (linear regression slope)
    const n = scores.length;
    const xValues = scores.map((_, i) => i);
    const yValues = scores.map(s => s.twitter_score);
    
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const velocity = slope / Math.max(1, last.twitter_score) * 100; // normalized
    
    // Calculate acceleration (second derivative approximation)
    const midpoint = Math.floor(n / 2);
    const firstHalfSlope = midpoint > 0 
      ? (yValues[midpoint] - yValues[0]) / midpoint 
      : 0;
    const secondHalfSlope = n - midpoint > 0 
      ? (yValues[n - 1] - yValues[midpoint]) / (n - midpoint) 
      : 0;
    const acceleration = (secondHalfSlope - firstHalfSlope) / Math.max(1, n);
    
    // Find peak and valley
    let peak = { date: '', value: 0 };
    let valley = { date: '', value: Infinity };
    let earlySignalsCount = 0;
    let breakoutsCount = 0;
    
    for (const point of scores) {
      if (point.twitter_score > peak.value) {
        peak = { date: point.ts.toISOString().split('T')[0], value: point.twitter_score };
      }
      if (point.twitter_score < valley.value) {
        valley = { date: point.ts.toISOString().split('T')[0], value: point.twitter_score };
      }
      if (point.early_signal?.badge === 'rising' || point.early_signal?.badge === 'breakout') {
        earlySignalsCount++;
      }
      if (point.early_signal?.badge === 'breakout') {
        breakoutsCount++;
      }
    }
    
    // Determine trend direction
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (velocity > 0.5) trendDirection = 'up';
    else if (velocity < -0.5) trendDirection = 'down';
    
    scoresSummary = {
      current: last.twitter_score,
      start: first.twitter_score,
      grade_current: last.grade,
      grade_start: first.grade,
      velocity: Number(velocity.toFixed(3)),
      acceleration: Number(acceleration.toFixed(4)),
      peak: peak.value > 0 ? peak : null,
      valley: valley.value < Infinity ? valley : null,
      trend_direction: trendDirection,
      early_signals_count: earlySignalsCount,
      breakouts_count: breakoutsCount,
    };
  } else if (scores.length === 1) {
    scoresSummary = {
      current: scores[0].twitter_score,
      start: scores[0].twitter_score,
      grade_current: scores[0].grade,
      grade_start: scores[0].grade,
      velocity: 0,
      acceleration: 0,
      peak: null,
      valley: null,
      trend_direction: 'stable',
      early_signals_count: 0,
      breakouts_count: 0,
    };
  }
  
  return {
    account_id,
    window_days: days,
    followers: followersSummary,
    engagement: engagementSummary,
    scores: scoresSummary,
  };
}

/**
 * Get accounts with most breakouts
 */
export async function getTopBreakoutAccounts(
  limit: number = 10,
  window: string = '30d'
): Promise<Array<{ account_id: string; breakouts: number; last_breakout: Date }>> {
  const days = parseWindow(window);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const result = await TSScoresModel.aggregate([
    { 
      $match: { 
        ts: { $gte: startDate },
        'early_signal.badge': 'breakout'
      } 
    },
    {
      $group: {
        _id: '$account_id',
        breakouts: { $sum: 1 },
        last_breakout: { $max: '$ts' },
      }
    },
    { $sort: { breakouts: -1 } },
    { $limit: limit },
    {
      $project: {
        account_id: '$_id',
        breakouts: 1,
        last_breakout: 1,
        _id: 0,
      }
    }
  ]);
  
  return result;
}
