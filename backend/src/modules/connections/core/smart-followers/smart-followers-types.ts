/**
 * Smart Followers Types
 * 
 * Types for Smart Followers Engine - quality of followers, not quantity
 */

export type AuthorityTier = 'elite' | 'high' | 'upper_mid' | 'mid' | 'low_mid' | 'low';

export interface SmartFollower {
  follower_id: string;
  authority_score_0_1: number; // 0..1
  authority_tier: AuthorityTier;
  handle?: string;
  label?: string;
}

export interface SmartFollowersInput {
  account_id: string;
  followers: SmartFollower[];
}

export interface SmartFollowersBreakdownItem {
  follower_id: string;
  authority_score_0_1: number;
  authority_tier: AuthorityTier;
  tier_multiplier: number;
  weight: number; // authority_score * tier_multiplier
  share_of_total: number; // 0..1
  handle?: string;
  label?: string;
}

export interface SmartFollowersResult {
  version: string;
  account_id: string;

  followers_count: number;

  // Main outputs
  smart_followers_score_0_1: number; // 0..1
  follower_value_index: number;      // quality per size

  // Top N by weight
  top_followers: SmartFollowersBreakdownItem[];

  // Breakdown
  breakdown: {
    total_weight: number;
    elite_weight_share: number; // 0..1
    high_weight_share: number;  // 0..1
    tier_shares: Record<AuthorityTier, number>; // weight share per tier
    tier_counts: Record<AuthorityTier, number>; // count per tier
  };

  // Explainable
  explain: {
    summary: string;
    drivers: string[];
    concerns: string[];
    recommendations: string[];
  };

  // Integration hint for twitter_score quality component
  integration: {
    suggested_quality_mix: {
      engagement: number;
      consistency: number;
      smart_followers: number;
    };
  };
}
