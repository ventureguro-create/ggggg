/**
 * Twitter Score Contracts v1.0
 * 
 * Unified scoring layer that aggregates existing Connections metrics
 * into a single 0-1000 score with grade and confidence.
 */

export type ConfidenceLevel = "LOW" | "MED" | "HIGH";
export type Grade = "D" | "C" | "B" | "A" | "S";

/**
 * Input for Twitter Score calculation
 * Uses existing Connections metrics
 */
export interface TwitterScoreInput {
  account_id: string;

  // Existing metrics from Connections engine
  base_influence?: number;        // 0..1000 (influence_score)
  x_score?: number;               // 0..1000 (quality score)
  signal_noise?: number;          // 0..10 (higher = better)
  risk_level?: "LOW" | "MED" | "HIGH";
  red_flags?: string[];           // LIKE_HEAVY, REPOST_FARM, VIRAL_SPIKE, etc.

  // Trends layer
  velocity?: number;              // points/day (can be negative)
  acceleration?: number;          // delta velocity

  // Early signal
  early_signal_badge?: "none" | "rising" | "breakout";
  early_signal_score?: number;    // 0..100

  // Future: Audience Quality (Phase 1.2)
  audience_quality?: {
    smart_followers_score?: number;
    top_followers_count?: number;
    tier1_share?: number;
    bot_share?: number;
    audience_purity_score?: number;
  };

  // Future: Handshakes (Phase 1.3)
  network_hops?: {
    avg_hops_to_top100?: number;
    reachable_whales?: number;
    shortest_path_to_key?: number;
  };

  // Phase 1.2: Audience Quality (replaces network_proxy)
  audience_quality_score_0_1?: number;

  // Phase 1.3: Hops / Authority Proximity
  authority_proximity_score_0_1?: number;

  // Phase 3.1: Authority Engine (PageRank-like centrality)
  authority_score_0_1?: number;

  // Phase 3.2: Smart Followers (quality of followers, not quantity)
  smart_followers_score_0_1?: number;
}

/**
 * Score components breakdown (all 0..1)
 */
export interface TwitterScoreComponents {
  influence: number;      // 0..1
  quality: number;        // 0..1 (combined: engagement + consistency + smart_followers)
  trend: number;          // 0..1
  network_proxy: number;  // 0..1 (combined: audience + proximity + authority)
  consistency: number;    // 0..1 (proxy until timeseries)
  risk_penalty: number;   // 0..1 (0 = good, 1 = bad)
  
  // Phase 3.1: Network sub-components breakdown
  network_sub?: {
    audience_quality: number;
    authority_proximity: number;
    authority_score: number;
  };
  
  // Phase 3.2: Quality sub-components breakdown
  quality_sub?: {
    engagement_quality: number;
    consistency_proxy: number;
    smart_followers: number;
  };
}

/**
 * Full Twitter Score result
 */
export interface TwitterScoreResult {
  account_id: string;

  twitter_score_1000: number; // 0..1000
  grade: Grade;
  confidence: ConfidenceLevel;

  components: TwitterScoreComponents;

  debug: {
    weighted_sum_0_1: number;
    weights: Record<string, number>;
    penalties: { red_flags_penalty: number; risk_penalty: number };
  };

  explain: {
    summary: string;
    drivers: string[];         // positive factors
    concerns: string[];        // negative factors
    recommendations: string[]; // improvement suggestions
    // Phase 3.4.2: Network breakdown
    network_explain?: {
      summary: string;
      details: string[];
    };
  };

  meta: {
    version: string;
    computed_at: string;
    data_sources: string[];
  };
}

/**
 * Batch result for multiple accounts
 */
export interface TwitterScoreBatchResult {
  version: string;
  computed_at: string;
  results: TwitterScoreResult[];
  stats: {
    total: number;
    by_grade: Record<Grade, number>;
    avg_score: number;
    avg_confidence: Record<ConfidenceLevel, number>;
  };
}
