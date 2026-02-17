/**
 * Normalize Author Metrics
 * 
 * Applies:
 * - Safe division with smart views estimation
 * - Engagement quality calculation
 * - Activity weight (log scale)
 * - Engagement ratio for anomaly detection
 * - Caps and penalties (v1)
 */

import type { AuthorSignals } from '../signals/extract-author-signals.js';

export interface NormalizedAuthorMetrics extends AuthorSignals {
  normalized: {
    engagement_quality: number;  // 0-1 scale
    activity_weight: number;     // log scale
    total_engagement: number;
    weighted_engagement: number; // для расчёта volatility
    engagement_ratio: number;    // total_engagement / views (для red flags)
    has_real_views: boolean;     // были ли реальные views
  };
}

/**
 * Estimate views when not provided
 * Uses industry-standard engagement rate benchmarks:
 * - Typical Twitter engagement rate: 0.5% - 3%
 * - We use 2% as baseline (middle ground)
 */
function estimateViews(totalEngagement: number, hasViews: boolean, actualViews: number | null): number {
  // If we have real views, use them
  if (hasViews && actualViews && actualViews > 0) {
    return actualViews;
  }
  
  // No engagement = minimal views
  if (totalEngagement === 0) {
    return 100; // Assume at least 100 impressions for any post
  }
  
  // Estimate based on 2% engagement rate
  // engagement_rate = engagement / views => views = engagement / 0.02
  const estimatedViews = Math.round(totalEngagement / 0.02);
  
  // Cap between reasonable bounds
  return Math.max(100, Math.min(estimatedViews, totalEngagement * 200));
}

export function normalizeAuthorMetrics(signals: AuthorSignals): NormalizedAuthorMetrics {
  const { likes, reposts, replies, views } = signals.metrics;

  // Total engagement
  const totalEngagement = likes + reposts + replies;
  
  // Check if we have real views data
  const hasRealViews = views !== null && views !== undefined && views > 0;
  
  // Smart views estimation
  const safeViews = estimateViews(totalEngagement, hasRealViews, views);

  // Engagement quality: weighted sum / views
  // Weights: likes=1, reposts=2 (more effort), replies=3 (most valuable - conversation)
  const weightedEngagement = likes * 1 + reposts * 2 + replies * 3;
  
  // Calculate quality with diminishing returns for very high engagement
  // This prevents gaming by massive like-bombing
  const rawQuality = weightedEngagement / safeViews;
  const engagementQuality = Math.min(rawQuality, 1);

  // Activity weight (log scale to dampen outliers)
  const activityWeight = Math.log1p(totalEngagement);
  
  // Engagement ratio for anomaly detection
  // Normal: 0.5% - 5%, Suspicious: > 10%, Very suspicious: > 50%
  const engagementRatio = safeViews > 0 ? totalEngagement / safeViews : 0;

  return {
    ...signals,
    normalized: {
      engagement_quality: Math.round(engagementQuality * 10000) / 10000,
      activity_weight: Math.round(activityWeight * 100) / 100,
      total_engagement: totalEngagement,
      weighted_engagement: weightedEngagement,
      engagement_ratio: Math.round(engagementRatio * 10000) / 10000,
      has_real_views: hasRealViews,
    },
  };
}
