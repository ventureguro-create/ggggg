/**
 * Live Participation Blender (Phase 4.3.1)
 * 
 * Blends mock and live values based on participation weights.
 * 
 * Core formula:
 * blended = mock * (1 - w) + live * w
 * 
 * Where w = effective_weight / 100 (0 to 1)
 */

import { getParticipationConfig, getEffectiveWeight, type LiveParticipationConfig } from './participation.config.js';

/**
 * Blend single value
 */
export function blendValue(mock: number, live: number, weight: number): number {
  const w = Math.max(0, Math.min(weight / 100, 1));  // Clamp to 0-1
  return mock * (1 - w) + live * w;
}

/**
 * Blended metrics result
 */
export interface BlendedMetrics {
  mock: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
  };
  live: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
  };
  blended: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
  };
  weights: {
    followers: number;
    engagement: number;
    graph_edges: number;
    audience_quality: number;
    authority: number;
  };
  delta: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
  };
}

/**
 * Compute blended metrics for an account
 */
export function computeBlendedMetrics(
  mockMetrics: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
    followers?: number;
    engagement_rate?: number;
  },
  liveMetrics: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
    followers?: number;
    engagement_rate?: number;
  }
): BlendedMetrics {
  const config = getParticipationConfig();
  
  // Get effective weights
  const weights = {
    followers: getEffectiveWeight('followers'),
    engagement: getEffectiveWeight('engagement'),
    graph_edges: getEffectiveWeight('graph_edges'),
    audience_quality: getEffectiveWeight('audience_quality'),
    authority: getEffectiveWeight('authority'),
  };
  
  // If nothing enabled, return mock
  if (!config.enabled) {
    return {
      mock: {
        twitter_score: mockMetrics.twitter_score,
        audience_quality: mockMetrics.audience_quality,
        authority: mockMetrics.authority,
        smart_followers: mockMetrics.smart_followers,
      },
      live: {
        twitter_score: liveMetrics.twitter_score,
        audience_quality: liveMetrics.audience_quality,
        authority: liveMetrics.authority,
        smart_followers: liveMetrics.smart_followers,
      },
      blended: {
        twitter_score: mockMetrics.twitter_score,
        audience_quality: mockMetrics.audience_quality,
        authority: mockMetrics.authority,
        smart_followers: mockMetrics.smart_followers,
      },
      weights,
      delta: {
        twitter_score: 0,
        audience_quality: 0,
        authority: 0,
        smart_followers: 0,
      },
    };
  }
  
  // Calculate blended score
  // Score is influenced by multiple components
  const avgScoreWeight = (
    weights.followers + 
    weights.engagement + 
    weights.graph_edges
  ) / 3;
  
  const blended_twitter_score = Math.round(
    blendValue(mockMetrics.twitter_score, liveMetrics.twitter_score, avgScoreWeight)
  );
  
  const blended_audience_quality = parseFloat(
    blendValue(mockMetrics.audience_quality, liveMetrics.audience_quality, weights.audience_quality).toFixed(2)
  );
  
  const blended_authority = parseFloat(
    blendValue(mockMetrics.authority, liveMetrics.authority, weights.authority).toFixed(2)
  );
  
  const blended_smart_followers = Math.round(
    blendValue(mockMetrics.smart_followers, liveMetrics.smart_followers, weights.authority)  // Authority influences smart followers
  );
  
  return {
    mock: {
      twitter_score: mockMetrics.twitter_score,
      audience_quality: mockMetrics.audience_quality,
      authority: mockMetrics.authority,
      smart_followers: mockMetrics.smart_followers,
    },
    live: {
      twitter_score: liveMetrics.twitter_score,
      audience_quality: liveMetrics.audience_quality,
      authority: liveMetrics.authority,
      smart_followers: liveMetrics.smart_followers,
    },
    blended: {
      twitter_score: blended_twitter_score,
      audience_quality: blended_audience_quality,
      authority: blended_authority,
      smart_followers: blended_smart_followers,
    },
    weights,
    delta: {
      twitter_score: blended_twitter_score - mockMetrics.twitter_score,
      audience_quality: parseFloat((blended_audience_quality - mockMetrics.audience_quality).toFixed(2)),
      authority: parseFloat((blended_authority - mockMetrics.authority).toFixed(2)),
      smart_followers: blended_smart_followers - mockMetrics.smart_followers,
    },
  };
}

/**
 * Preview what would happen if weights were applied
 * Without actually applying them
 */
export function previewBlend(
  mockMetrics: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
  },
  liveMetrics: {
    twitter_score: number;
    audience_quality: number;
    authority: number;
    smart_followers: number;
  },
  previewWeights: {
    followers?: number;
    engagement?: number;
    graph_edges?: number;
    audience_quality?: number;
    authority?: number;
  }
): BlendedMetrics {
  // Temporarily set weights for preview
  const weights = {
    followers: previewWeights.followers ?? 0,
    engagement: previewWeights.engagement ?? 0,
    graph_edges: previewWeights.graph_edges ?? 0,
    audience_quality: previewWeights.audience_quality ?? 0,
    authority: previewWeights.authority ?? 0,
  };
  
  const avgScoreWeight = (
    weights.followers + 
    weights.engagement + 
    weights.graph_edges
  ) / 3;
  
  const blended_twitter_score = Math.round(
    blendValue(mockMetrics.twitter_score, liveMetrics.twitter_score, avgScoreWeight)
  );
  
  const blended_audience_quality = parseFloat(
    blendValue(mockMetrics.audience_quality, liveMetrics.audience_quality, weights.audience_quality).toFixed(2)
  );
  
  const blended_authority = parseFloat(
    blendValue(mockMetrics.authority, liveMetrics.authority, weights.authority).toFixed(2)
  );
  
  const blended_smart_followers = Math.round(
    blendValue(mockMetrics.smart_followers, liveMetrics.smart_followers, weights.authority)
  );
  
  return {
    mock: { ...mockMetrics },
    live: { ...liveMetrics },
    blended: {
      twitter_score: blended_twitter_score,
      audience_quality: blended_audience_quality,
      authority: blended_authority,
      smart_followers: blended_smart_followers,
    },
    weights,
    delta: {
      twitter_score: blended_twitter_score - mockMetrics.twitter_score,
      audience_quality: parseFloat((blended_audience_quality - mockMetrics.audience_quality).toFixed(2)),
      authority: parseFloat((blended_authority - mockMetrics.authority).toFixed(2)),
      smart_followers: blended_smart_followers - mockMetrics.smart_followers,
    },
  };
}

/**
 * Get grade from score
 */
export function getGrade(score: number): string {
  if (score >= 900) return 'S';
  if (score >= 800) return 'A+';
  if (score >= 700) return 'A';
  if (score >= 600) return 'B+';
  if (score >= 500) return 'B';
  if (score >= 400) return 'C+';
  if (score >= 300) return 'C';
  if (score >= 200) return 'D';
  return 'F';
}

/**
 * Check if grade changed
 */
export function gradeChanged(mockScore: number, blendedScore: number): { changed: boolean; from: string; to: string } {
  const fromGrade = getGrade(mockScore);
  const toGrade = getGrade(blendedScore);
  return {
    changed: fromGrade !== toGrade,
    from: fromGrade,
    to: toGrade,
  };
}
