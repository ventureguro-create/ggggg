/**
 * Follow Graph v2 - Weight Calculation
 * 
 * PHASE A1 COMPLETE FORMULAS:
 * 
 * follow_weight = 
 *   authority(follower)     // 0.3..1.5 - who follows matters
 *   × recency_decay         // e^(-days/180) - fresh > old
 *   × activity_factor       // min(1, tweets_30d/10) - dead legends penalty
 *   × credibility_factor    // 0.3..1.3 - talking book vs reality-confirmed
 */

import { FollowWeight, FollowWeightConfig, DEFAULT_FOLLOW_CONFIG } from './follow.types.js';

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate authority boost based on follower's authority
 * 
 * Higher authority follower = stronger signal
 * - If top (authority ~98) follows small account → high weight
 * - If bot (authority ~0) follows → almost zero weight
 */
export function authorityBoost(
  followerAuthority: number,
  config: FollowWeightConfig = DEFAULT_FOLLOW_CONFIG
): number {
  // Normalize authority to 0-100 scale
  const normalizedAuth = followerAuthority > 1 ? followerAuthority : followerAuthority * 100;
  
  // Formula: 0.3 + authority/100, clamped to [0.3, 1.5]
  const boost = 0.3 + normalizedAuth / 100;
  return clamp(boost, config.authorityMultiplierMin, config.authorityMultiplierMax);
}

/**
 * Calculate recency decay
 * 
 * Fresh follow = more important
 * Old follow = still relevant but decayed
 * 
 * Half-life: 180 days (after 180 days, weight is ~50%)
 */
export function recencyDecay(
  followedAt: Date,
  config: FollowWeightConfig = DEFAULT_FOLLOW_CONFIG
): number {
  const now = new Date();
  const daysSinceFollow = Math.max(0, 
    (now.getTime() - followedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Exponential decay: e^(-days / halfLife)
  const decay = Math.exp(-daysSinceFollow / config.recencyHalfLifeDays);
  
  // Ensure minimum weight
  return Math.max(config.minRecencyWeight, decay);
}

/**
 * PHASE A1: Calculate activity factor
 * 
 * Dead legends penalty - if account is inactive, follows lose value
 * But silent whales still count (min 0.2)
 */
export function activityFactor(
  tweets30d: number,
  config: FollowWeightConfig = DEFAULT_FOLLOW_CONFIG
): number {
  const factor = Math.min(1, tweets30d / config.activityTweetsThreshold);
  return clamp(factor, config.activityMinWeight, 1.0);
}

/**
 * PHASE A1: Calculate credibility factor from Reality Layer
 * 
 * Based on actor's trust multiplier:
 * - Talking book (says one thing, does another) → 0.3
 * - Neutral → 1.0
 * - Reality-confirmed (actions match words) → 1.3
 */
export function credibilityFactor(
  trustMultiplier: number,
  config: FollowWeightConfig = DEFAULT_FOLLOW_CONFIG
): number {
  return clamp(trustMultiplier, config.credibilityMin, config.credibilityMax);
}

export interface ComputeFollowWeightParams {
  followerAuthority: number;
  followedAt: Date;
  tweets30d?: number;       // NEW: activity metric
  trustMultiplier?: number; // NEW: from Reality Layer
}

/**
 * Compute final follow weight with all factors
 */
export function computeFollowWeight(
  followerAuthority: number,
  followedAt: Date,
  config: FollowWeightConfig = DEFAULT_FOLLOW_CONFIG
): FollowWeight;

export function computeFollowWeight(
  params: ComputeFollowWeightParams,
  config?: FollowWeightConfig
): FollowWeight;

export function computeFollowWeight(
  paramsOrAuth: number | ComputeFollowWeightParams,
  followedAtOrConfig?: Date | FollowWeightConfig,
  maybeConfig?: FollowWeightConfig
): FollowWeight {
  // Handle both call signatures for backward compatibility
  let followerAuthority: number;
  let followedAt: Date;
  let tweets30d: number;
  let trustMultiplier: number;
  let config: FollowWeightConfig;
  
  if (typeof paramsOrAuth === 'number') {
    // Legacy signature: (authority, date, config?)
    followerAuthority = paramsOrAuth;
    followedAt = followedAtOrConfig as Date;
    tweets30d = 10; // default: active
    trustMultiplier = 1.0; // default: neutral
    config = maybeConfig ?? DEFAULT_FOLLOW_CONFIG;
  } else {
    // New signature: (params, config?)
    followerAuthority = paramsOrAuth.followerAuthority;
    followedAt = paramsOrAuth.followedAt;
    tweets30d = paramsOrAuth.tweets30d ?? 10;
    trustMultiplier = paramsOrAuth.trustMultiplier ?? 1.0;
    config = (followedAtOrConfig as FollowWeightConfig) ?? DEFAULT_FOLLOW_CONFIG;
  }
  
  const authBoost = authorityBoost(followerAuthority, config);
  const recency = recencyDecay(followedAt, config);
  const activity = activityFactor(tweets30d, config);
  const credibility = credibilityFactor(trustMultiplier, config);
  
  // Final weight = base × authorityBoost × recencyDecay × activityFactor × credibilityFactor
  const finalWeight = config.baseWeight * authBoost * recency * activity * credibility;
  
  return {
    authorityBoost: Math.round(authBoost * 1000) / 1000,
    recencyDecay: Math.round(recency * 1000) / 1000,
    activityFactor: Math.round(activity * 1000) / 1000,
    credibilityFactor: Math.round(credibility * 1000) / 1000,
    finalWeight: Math.round(finalWeight * 1000) / 1000,
  };
}

/**
 * Aggregate follow weights for a target account
 * 
 * Returns the total "followed by top accounts" score
 */
export function aggregateFollowScore(
  followWeights: FollowWeight[]
): number {
  if (followWeights.length === 0) return 0;
  
  // Sum of weights with diminishing returns
  let total = 0;
  const sorted = [...followWeights].sort((a, b) => b.finalWeight - a.finalWeight);
  
  for (let i = 0; i < sorted.length; i++) {
    // Diminishing returns: each additional follow contributes less
    const diminishing = 1 / (1 + i * 0.3);
    total += sorted[i].finalWeight * diminishing;
  }
  
  // Normalize to 0-1 scale
  return Math.min(1, total);
}
