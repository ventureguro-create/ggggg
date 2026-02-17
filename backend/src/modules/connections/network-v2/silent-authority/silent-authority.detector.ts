/**
 * Silent Authority Detector - Network v2
 * 
 * KILLER FEATURE: Detects high-authority accounts with low activity
 * These are often: funds, core devs, architects, insiders
 * 
 * They don't post much, but when they do - the market listens.
 */

import type { AuthorityScore, NetworkV2Profile } from '../network-v2.types.js';

// ============================================================
// TYPES
// ============================================================

export type SilentAuthorityFlag = 'NONE' | 'SILENT_AUTHORITY' | 'HIDDEN_ELITE';

export interface SilentAuthorityInput {
  account_id: string;
  handle: string;
  
  // Authority metrics
  authority_score: number;      // 0-1
  authority_tier: string;       // 'ELITE' | 'HIGH' | etc
  
  // Activity metrics
  tweets_30d: number;
  engagement_30d: number;       // Total engagement received
  
  // Network metrics
  inbound_elite_count: number;  // How many elite/high accounts follow/engage
  followers_count: number;
  followers_growth_30d: number; // % change
  
  // Confidence
  confidence: number;           // 0-1
}

export interface SilentAuthorityResult {
  account_id: string;
  handle: string;
  flag: SilentAuthorityFlag;
  score: number;                // 0-1 (how "silent authority" they are)
  reasons: string[];
  
  // Breakdown
  breakdown: {
    authority_factor: number;
    silence_factor: number;
    inbound_factor: number;
    stability_factor: number;
  };
  
  // Alert recommendation
  should_alert: boolean;
  alert_confidence: number;
}

// ============================================================
// CONFIG
// ============================================================

export interface SilentAuthorityConfig {
  enabled: boolean;
  
  // Thresholds for detection
  min_authority_score: number;    // 0.72 - must be authority
  max_tweets_30d: number;         // 10 - must be quiet
  max_engagement_rate: number;    // 0.25 - not engagement farming
  min_inbound_elite: number;      // 3 - must have elite followers
  
  // Alert settings
  alert_confidence_threshold: number;  // 0.75
  alert_cooldown_hours: number;        // 72 - don't spam
  
  // Scoring weights
  weights: {
    authority: number;            // 0.35
    silence: number;              // 0.25
    inbound: number;              // 0.25
    stability: number;            // 0.15
  };
}

export const DEFAULT_SILENT_AUTHORITY_CONFIG: SilentAuthorityConfig = {
  enabled: true,
  
  min_authority_score: 0.72,
  max_tweets_30d: 10,
  max_engagement_rate: 0.25,
  min_inbound_elite: 3,
  
  alert_confidence_threshold: 0.75,
  alert_cooldown_hours: 72,
  
  weights: {
    authority: 0.35,
    silence: 0.25,
    inbound: 0.25,
    stability: 0.15,
  },
};

// ============================================================
// DETECTOR
// ============================================================

/**
 * Detect if an account is a Silent Authority
 */
export function detectSilentAuthority(
  input: SilentAuthorityInput,
  cfg: SilentAuthorityConfig = DEFAULT_SILENT_AUTHORITY_CONFIG
): SilentAuthorityResult {
  const reasons: string[] = [];
  
  // 1. Authority Factor (0-1)
  const isAuthority = input.authority_score >= cfg.min_authority_score;
  const authorityFactor = isAuthority 
    ? Math.min(1, input.authority_score / 0.9)  // Normalize to 0.9 as "perfect"
    : 0;
  
  if (isAuthority) {
    reasons.push(`High authority: ${Math.round(input.authority_score * 100)}% (tier: ${input.authority_tier})`);
  }
  
  // 2. Silence Factor (0-1)
  const isSilent = input.tweets_30d <= cfg.max_tweets_30d;
  const engagementRate = input.followers_count > 0 
    ? input.engagement_30d / input.followers_count 
    : 0;
  const isLowEngagement = engagementRate <= cfg.max_engagement_rate;
  
  let silenceFactor = 0;
  if (isSilent) {
    // The fewer tweets, the more "silent"
    silenceFactor = 1 - (input.tweets_30d / (cfg.max_tweets_30d * 2));
    silenceFactor = Math.max(0, Math.min(1, silenceFactor));
    reasons.push(`Low activity: ${input.tweets_30d} tweets in 30d`);
  }
  if (isLowEngagement) {
    silenceFactor = Math.min(1, silenceFactor + 0.2);
    reasons.push(`Low engagement rate: ${Math.round(engagementRate * 100)}%`);
  }
  
  // 3. Inbound Factor (0-1)
  const hasInbound = input.inbound_elite_count >= cfg.min_inbound_elite;
  const inboundFactor = hasInbound
    ? Math.min(1, input.inbound_elite_count / 10)  // 10 elite inbound = max
    : 0;
  
  if (hasInbound) {
    reasons.push(`Strong inbound: ${input.inbound_elite_count} elite/high tier connections`);
  }
  
  // 4. Stability Factor (0-1)
  // Low churn = high stability
  const isStable = Math.abs(input.followers_growth_30d) < 10; // < 10% change
  const stabilityFactor = isStable 
    ? 1 - (Math.abs(input.followers_growth_30d) / 20)
    : 0.3;
  
  if (isStable) {
    reasons.push(`Stable audience: ${input.followers_growth_30d > 0 ? '+' : ''}${Math.round(input.followers_growth_30d)}% growth`);
  }
  
  // 5. Calculate final score
  const score = 
    authorityFactor * cfg.weights.authority +
    silenceFactor * cfg.weights.silence +
    inboundFactor * cfg.weights.inbound +
    stabilityFactor * cfg.weights.stability;
  
  // 6. Determine flag
  let flag: SilentAuthorityFlag = 'NONE';
  
  if (isAuthority && isSilent && hasInbound) {
    if (input.authority_tier === 'ELITE') {
      flag = 'HIDDEN_ELITE';
    } else {
      flag = 'SILENT_AUTHORITY';
    }
  }
  
  // 7. Alert recommendation
  const shouldAlert = 
    flag !== 'NONE' && 
    input.confidence >= cfg.alert_confidence_threshold &&
    cfg.enabled;
  
  return {
    account_id: input.account_id,
    handle: input.handle,
    flag,
    score: Math.round(score * 1000) / 1000,
    reasons,
    breakdown: {
      authority_factor: Math.round(authorityFactor * 100) / 100,
      silence_factor: Math.round(silenceFactor * 100) / 100,
      inbound_factor: Math.round(inboundFactor * 100) / 100,
      stability_factor: Math.round(stabilityFactor * 100) / 100,
    },
    should_alert: shouldAlert,
    alert_confidence: Math.round(input.confidence * 100) / 100,
  };
}

/**
 * Batch detect silent authorities
 */
export function detectSilentAuthoritiesBatch(
  inputs: SilentAuthorityInput[],
  cfg: SilentAuthorityConfig = DEFAULT_SILENT_AUTHORITY_CONFIG
): SilentAuthorityResult[] {
  return inputs
    .map(input => detectSilentAuthority(input, cfg))
    .filter(result => result.flag !== 'NONE')
    .sort((a, b) => b.score - a.score);
}

console.log('[SilentAuthority] Detector module loaded');
