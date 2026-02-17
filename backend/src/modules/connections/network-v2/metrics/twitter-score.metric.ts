/**
 * Twitter Score v2 Calculator
 * 
 * TwitterScore = 0.22×Influence + 0.23×Smart + 0.25×Network + 0.15×Early + 0.15×Activity
 * 
 * All components normalized to 0-1, final score scaled to 0-1000.
 */

import type { TwitterScoreV2 } from '../network-v2-plus.types.js';
import { TWITTER_SCORE_WEIGHTS, NETWORK_WEIGHTS } from '../network-v2-plus.types.js';

export interface TwitterScoreInput {
  // Influence
  followers: number;
  engagementRate: number;  // 0-1
  credibility: number;     // 0-1 (bot penalty, etc)
  
  // Smart
  readerWeightSum: number; // Sum of (ReaderWeight × Interaction)
  maxPossibleReaderWeight: number; // For normalization
  
  // Network
  seedAuthority: number;      // 0-1
  inheritedAuthority: number; // 0-1
  graphCentrality: number;    // 0-1
  
  // Early
  earlySignalAvg: number;  // 0-1 (avg of early detections)
  
  // Activity
  frequency: number;       // 0-1 (normalized tweets/day)
  consistency: number;     // 0-1
  longevity: number;       // 0-1 (account age factor)
}

/**
 * Calculate Influence component
 * Influence = log(Followers) × EngagementRate × Credibility
 */
export function calculateInfluence(
  followers: number,
  engagementRate: number,
  credibility: number
): number {
  if (followers <= 0) return 0;
  
  // Normalize log(followers) to 0-1 range
  // Using log10, where 1M followers = 1.0
  const logFollowers = Math.log10(followers) / 6; // 10^6 = 1M
  const normalizedFollowers = Math.min(1, Math.max(0, logFollowers));
  
  return normalizedFollowers * engagementRate * credibility;
}

/**
 * Calculate Smart component
 * Smart = Σ(ReaderWeight_i × Interaction_i)
 */
export function calculateSmart(
  readerWeightSum: number,
  maxPossibleWeight: number
): number {
  if (maxPossibleWeight <= 0) return 0;
  return Math.min(1, readerWeightSum / maxPossibleWeight);
}

/**
 * Calculate Network component
 * Network = 0.40×SeedAuthority + 0.35×InheritedAuthority + 0.25×GraphCentrality
 */
export function calculateNetwork(
  seedAuthority: number,
  inheritedAuthority: number,
  graphCentrality: number
): number {
  return (
    NETWORK_WEIGHTS.seedAuthority * seedAuthority +
    NETWORK_WEIGHTS.inheritedAuthority * inheritedAuthority +
    NETWORK_WEIGHTS.graphCentrality * graphCentrality
  );
}

/**
 * Calculate Early component
 * Early = 1 - avg((tweet_time - event_time) / window)
 */
export function calculateEarly(earlySignalAvg: number): number {
  return Math.min(1, Math.max(0, earlySignalAvg));
}

/**
 * Calculate Activity component
 * Activity = Frequency × Consistency × Longevity
 */
export function calculateActivity(
  frequency: number,
  consistency: number,
  longevity: number
): number {
  return frequency * consistency * longevity;
}

/**
 * Calculate full Twitter Score v2
 */
export function calculateTwitterScoreV2(input: TwitterScoreInput): TwitterScoreV2 {
  const influence = calculateInfluence(
    input.followers,
    input.engagementRate,
    input.credibility
  );
  
  const smart = calculateSmart(
    input.readerWeightSum,
    input.maxPossibleReaderWeight
  );
  
  const network = calculateNetwork(
    input.seedAuthority,
    input.inheritedAuthority,
    input.graphCentrality
  );
  
  const early = calculateEarly(input.earlySignalAvg);
  
  const activity = calculateActivity(
    input.frequency,
    input.consistency,
    input.longevity
  );
  
  // Weighted sum (0-1)
  const normalizedScore =
    TWITTER_SCORE_WEIGHTS.influence * influence +
    TWITTER_SCORE_WEIGHTS.smart * smart +
    TWITTER_SCORE_WEIGHTS.network * network +
    TWITTER_SCORE_WEIGHTS.early * early +
    TWITTER_SCORE_WEIGHTS.activity * activity;
  
  // Scale to 0-1000
  const score = Math.round(normalizedScore * 1000);
  
  return {
    influence,
    smart,
    network,
    early,
    activity,
    score,
    details: {
      followers: input.followers,
      engagementRate: input.engagementRate,
      credibility: input.credibility,
      readerWeightSum: input.readerWeightSum,
      seedAuthority: input.seedAuthority,
      inheritedAuthority: input.inheritedAuthority,
      graphCentrality: input.graphCentrality,
      earlySignalAvg: input.earlySignalAvg,
      frequency: input.frequency,
      consistency: input.consistency,
    },
  };
}

/**
 * Quick estimate with defaults (for batch processing)
 */
export function estimateTwitterScore(
  followers: number,
  engagementRate: number,
  seedAuthority: number,
  inheritedAuthority: number
): number {
  const influence = calculateInfluence(followers, engagementRate, 0.8);
  const network = calculateNetwork(seedAuthority, inheritedAuthority, 0.3);
  
  // Simplified: assume average smart/early/activity
  const normalizedScore =
    TWITTER_SCORE_WEIGHTS.influence * influence +
    TWITTER_SCORE_WEIGHTS.smart * 0.4 +
    TWITTER_SCORE_WEIGHTS.network * network +
    TWITTER_SCORE_WEIGHTS.early * 0.3 +
    TWITTER_SCORE_WEIGHTS.activity * 0.5;
  
  return Math.round(normalizedScore * 1000);
}

console.log('[TwitterScoreV2] Calculator loaded');
