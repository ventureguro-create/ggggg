/**
 * Compute Influence Score (v1 - engagement-based with decay)
 * 
 * Features:
 * - Time decay for recent activity weighting
 * - Volatility calculation
 * - Enhanced red flags detection
 * - Engagement-based scoring (no followers required)
 */

import type { NormalizedAuthorMetrics } from '../normalization/normalize-author-metrics.js';
import { decayWeight } from './connections-decay.js';

export interface AuthorProfile {
  author_id: string;
  handle: string;
  
  followers: number;
  follower_growth_30d: number;
  
  activity: {
    posts_count: number;
    posts_per_day: number;
    total_engagement: number;
    avg_engagement_quality: number;
    engagement_stability: 'low' | 'medium' | 'high' | 'unknown';
    volatility: 'low' | 'moderate' | 'high' | 'unknown';
  };
  
  engagement: {
    real_views_estimate: number;
    engagement_quality: number;
  };
  
  network: {
    network_purity_score: number;
    audience_overlap_score: number;
    artificial_engagement_score: number;
  };
  
  scores: {
    influence_score: number;      // 0-1000
    risk_level: 'low' | 'medium' | 'high' | 'unknown';
    red_flags: number;
    red_flag_reasons: string[];   // Explanations for red flags
  };
  
  // Internal tracking for volatility calculation
  _engagement_history?: number[];
  
  updated_at: string;
}

/**
 * Calculate volatility from engagement history
 * Uses coefficient of variation (CV = stddev / mean)
 */
function calculateVolatility(
  history: number[], 
  currentEngagement: number
): 'low' | 'moderate' | 'high' | 'unknown' {
  const allValues = [...history, currentEngagement].slice(-20); // Last 20 posts max
  
  if (allValues.length < 3) return 'unknown';
  
  const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  if (mean === 0) return 'unknown';
  
  const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean; // Coefficient of variation
  
  // CV thresholds:
  // < 0.3: low volatility (consistent engagement)
  // 0.3 - 0.7: moderate volatility (normal variation)
  // > 0.7: high volatility (erratic, possibly manipulated)
  if (cv < 0.3) return 'low';
  if (cv < 0.7) return 'moderate';
  return 'high';
}

/**
 * Calculate engagement stability from quality history
 */
function calculateStability(
  existingAvgQuality: number,
  currentQuality: number,
  postsCount: number
): 'low' | 'medium' | 'high' | 'unknown' {
  if (postsCount < 5) return 'unknown';
  
  // Check deviation from average
  const deviation = Math.abs(currentQuality - existingAvgQuality) / Math.max(existingAvgQuality, 0.001);
  
  if (deviation < 0.2) return 'high';   // Within 20% of average
  if (deviation < 0.5) return 'medium'; // Within 50%
  return 'low';                          // More than 50% deviation
}

/**
 * Detect red flags with explanations
 */
function detectRedFlags(
  influenceScore: number,
  engagementQuality: number,
  engagementRatio: number,
  volatility: string,
  hasRealViews: boolean
): { count: number; reasons: string[] } {
  const reasons: string[] = [];
  
  // Very low influence score
  if (influenceScore < 100) {
    reasons.push('Very low influence score (<100)');
  }
  
  // Near-zero engagement quality
  if (engagementQuality < 0.001) {
    reasons.push('Extremely low engagement quality');
  }
  
  // Suspiciously high engagement ratio (possible bot activity)
  // Normal Twitter engagement: 0.5% - 5%
  // Suspicious: > 10%
  // Very suspicious: > 50%
  if (engagementRatio > 0.5) {
    reasons.push('Abnormally high engagement ratio (>50%) - possible manipulation');
  } else if (engagementRatio > 0.1) {
    reasons.push('Elevated engagement ratio (>10%) - unusual pattern');
  }
  
  // High volatility indicates erratic behavior
  if (volatility === 'high') {
    reasons.push('High engagement volatility - inconsistent activity pattern');
  }
  
  // No real views data - lower confidence in metrics
  if (!hasRealViews && engagementQuality > 0.5) {
    reasons.push('High quality score without verified views data');
  }
  
  // Too consistent engagement (possible bot pattern)
  // CV < 0.1 with many posts is suspicious
  if (volatility === 'low' && engagementRatio > 0.05) {
    reasons.push('Suspiciously consistent engagement pattern');
  }
  
  return { count: reasons.length, reasons };
}

export function computeInfluenceScore(
  data: NormalizedAuthorMetrics,
  existingProfile?: Partial<AuthorProfile>
): AuthorProfile {
  const now = Date.now();
  const windowDays = 30;
  
  // Calculate decay weight for current post
  const decay = decayWeight(data.timestamp, now, windowDays);
  
  // Base score from engagement quality (scaled to 0-1000)
  // Apply decay to weight recent activity more
  const baseScore = Math.round(data.normalized.engagement_quality * 1000 * decay);
  
  // Activity bonus (up to +100 for high activity)
  const activityBonus = Math.min(data.normalized.activity_weight * 10 * decay, 100);
  
  // Final influence score (capped at 1000)
  const influenceScore = Math.min(baseScore + activityBonus, 1000);

  // Merge with existing profile stats
  const existingPostsCount = existingProfile?.activity?.posts_count ?? 0;
  const existingTotalEngagement = existingProfile?.activity?.total_engagement ?? 0;
  const existingAvgQuality = existingProfile?.activity?.avg_engagement_quality ?? 0;
  const engagementHistory = existingProfile?._engagement_history ?? [];

  const newPostsCount = existingPostsCount + 1;
  const newTotalEngagement = existingTotalEngagement + data.normalized.total_engagement;
  
  // Running average of engagement quality with decay
  // More recent posts have higher weight in the average
  const decayedExistingWeight = existingPostsCount * 0.9; // Slight decay on historical
  const newAvgQuality = 
    (existingAvgQuality * decayedExistingWeight + data.normalized.engagement_quality) / 
    (decayedExistingWeight + 1);

  // Calculate volatility from engagement history
  const volatility = calculateVolatility(engagementHistory, data.normalized.total_engagement);
  
  // Calculate engagement stability
  const engagementStability = calculateStability(
    existingAvgQuality, 
    data.normalized.engagement_quality, 
    newPostsCount
  );

  // Detect red flags with explanations
  const redFlagsResult = detectRedFlags(
    influenceScore,
    data.normalized.engagement_quality,
    data.normalized.engagement_ratio,
    volatility,
    data.normalized.has_real_views
  );

  // Risk level based on score and red flags
  let riskLevel: 'low' | 'medium' | 'high' | 'unknown' = 'unknown';
  if (redFlagsResult.count >= 3) {
    riskLevel = 'high';
  } else if (redFlagsResult.count >= 1 || influenceScore < 200) {
    riskLevel = 'medium';
  } else if (influenceScore >= 300) {
    riskLevel = 'low';
  }

  // Update engagement history (keep last 20)
  const newEngagementHistory = [...engagementHistory, data.normalized.total_engagement].slice(-20);

  return {
    author_id: data.author_id,
    handle: data.handle,
    
    // Follower data (populated externally if available)
    followers: existingProfile?.followers ?? 0,
    follower_growth_30d: existingProfile?.follower_growth_30d ?? 0,
    
    activity: {
      posts_count: newPostsCount,
      posts_per_day: 0, // Calculated externally with time window
      total_engagement: newTotalEngagement,
      avg_engagement_quality: Math.round(newAvgQuality * 10000) / 10000,
      engagement_stability: engagementStability,
      volatility: volatility,
    },
    
    engagement: {
      real_views_estimate: data.metrics.views ?? Math.round(data.normalized.total_engagement / 0.02),
      engagement_quality: data.normalized.engagement_quality,
    },
    
    network: {
      network_purity_score: 0,        // Requires follower analysis
      audience_overlap_score: 0,      // Calculated via compare endpoint
      artificial_engagement_score: redFlagsResult.count >= 2 ? 0.5 : 0, // Basic estimate from red flags
    },
    
    scores: {
      influence_score: Math.round(influenceScore * 10) / 10,
      risk_level: riskLevel,
      red_flags: redFlagsResult.count,
      red_flag_reasons: redFlagsResult.reasons,
    },
    
    // Internal tracking
    _engagement_history: newEngagementHistory,
    
    updated_at: new Date().toISOString(),
  };
}
