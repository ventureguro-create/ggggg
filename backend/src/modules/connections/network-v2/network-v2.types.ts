/**
 * Network v2 - Follow Graph Authority
 * 
 * Types for the new network layer based on real follow relationships
 * 
 * Core signals:
 * 1. Follow Authority - who follows whom, weighted by follower's authority
 * 2. Social Distance (Hops) - proximity in the follow graph
 * 3. Elite Exposure - % of elite/high tier followers
 */

// ============================================================
// AUTHORITY TIERS
// ============================================================

export type AuthorityTier = 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface AuthorityScore {
  tier: AuthorityTier;
  score: number;          // 0-100
  based_on: {
    followers_quality: number;
    engagement_quality: number;
    network_position: number;
  };
}

// ============================================================
// FOLLOW RELATIONSHIP
// ============================================================

export interface FollowRelationship {
  follower_id: string;
  following_id: string;
  follower_authority: AuthorityScore;
  discovered_at: string;
  last_verified: string;
  weight: number;         // Contribution to following's network score
}

// ============================================================
// SOCIAL DISTANCE (HOPS)
// ============================================================

export type HopDistance = 1 | 2 | 3 | 'DISTANT';

export interface SocialPath {
  from_id: string;
  to_id: string;
  hops: HopDistance;
  path: string[];         // IDs of accounts in path
  path_authority: number; // Average authority of path
  signal_strength: number;
}

export const HOP_WEIGHTS = {
  1: 1.0,    // Direct connection - full weight
  2: 0.5,   // One degree of separation
  3: 0.2,   // Two degrees
  'DISTANT': 0.05,
} as const;

// ============================================================
// ELITE EXPOSURE
// ============================================================

export interface EliteExposure {
  account_id: string;
  total_followers: number;
  elite_followers: number;
  high_followers: number;
  elite_percentage: number;   // Key metric
  exposure_score: number;     // 0-100
}

// ============================================================
// NETWORK V2 PROFILE
// ============================================================

export interface NetworkV2Profile {
  account_id: string;
  handle: string;
  
  // Core metrics
  authority: AuthorityScore;
  elite_exposure: EliteExposure;
  
  // Graph position
  inbound_connections: number;    // Followers
  outbound_connections: number;   // Following
  high_value_connections: number; // Elite + High tier
  
  // Computed scores
  network_influence: number;      // 0-100
  network_trust: number;          // 0-100
  smart_no_name_score: number;    // Special: high quality, low followers
  
  // Paths to key accounts
  elite_paths: SocialPath[];      // Shortest paths to elite accounts
  
  // Timestamps
  calculated_at: string;
  confidence: number;
}

// ============================================================
// NETWORK V2 CONFIG
// ============================================================

export interface NetworkV2Config {
  version: string;
  status: 'DISABLED' | 'SHADOW' | 'ACTIVE';
  
  // Weights for final score
  weights: {
    follow_authority: number;     // 0.35
    social_distance: number;      // 0.25
    elite_exposure: number;       // 0.25
    co_engagement: number;        // 0.15 (legacy v1)
  };
  
  // Blend with v1
  v1_v2_blend: {
    v1_weight: number;            // Start at 0.80
    v2_weight: number;            // Start at 0.20
  };
  
  // Safety
  confidence_gate: number;        // 0.70
  drift_blocks_v2: boolean;
  max_v2_weight: number;          // 0.30 cap during rollout
  
  // Processing
  batch_size: number;
  update_frequency_hours: number;
  
  // Status
  last_updated: string | null;
  accounts_processed: number;
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

export const DEFAULT_NETWORK_V2_CONFIG: NetworkV2Config = {
  version: 'v2.0',
  status: 'DISABLED',
  
  weights: {
    follow_authority: 0.35,
    social_distance: 0.25,
    elite_exposure: 0.25,
    co_engagement: 0.15,
  },
  
  v1_v2_blend: {
    v1_weight: 0.80,
    v2_weight: 0.20,
  },
  
  confidence_gate: 0.70,
  drift_blocks_v2: true,
  max_v2_weight: 0.30,
  
  batch_size: 100,
  update_frequency_hours: 6,
  
  last_updated: null,
  accounts_processed: 0,
};

// ============================================================
// AUTHORITY TIER THRESHOLDS
// ============================================================

export const AUTHORITY_THRESHOLDS = {
  ELITE: 90,      // Top 1%
  HIGH: 70,       // Top 10%
  MEDIUM: 40,     // Top 50%
  LOW: 10,        // Bottom 50%
} as const;

console.log('[NetworkV2] Types module loaded');
