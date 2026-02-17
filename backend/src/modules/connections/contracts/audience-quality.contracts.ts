/**
 * Audience Quality Contracts v1.0
 * 
 * Defines the structure for audience quality assessment.
 * Works with proxy data now, ready for Twitter follower/follow graph later.
 */

export type ConfidenceLevel = "LOW" | "MED" | "HIGH";

/**
 * Input for Audience Quality calculation
 * Uses proxy signals until Twitter data is available
 */
export interface AudienceQualityInput {
  account_id: string;

  // Proxy inputs (already available today)
  x_score?: number;            // 0..1000
  signal_noise?: number;       // 0..10
  consistency_0_1?: number;    // 0..1 (optional)
  red_flags?: string[];        // incl. AUDIENCE_OVERLAP, BOT_LIKE_PATTERN, REPOST_FARM

  // Overlap proxy (from graph/compare)
  overlap?: {
    avg_jaccard?: number;        // 0..1
    max_jaccard?: number;        // 0..1
    avg_shared?: number;         // avg shared engaged ids
    max_shared?: number;
    sample_size?: number;        // number of comparisons (confidence signal)
  };

  // Optional profile data
  followers_count?: number;
  early_signal_badge?: "none" | "rising" | "breakout";

  // Future: Real Twitter follower data (Phase 2+)
  twitter_followers?: {
    tier1_followers?: string[];  // known high-quality follower ids
    bot_detected_count?: number;
    total_analyzed?: number;
  };
}

/**
 * Evidence breakdown for UI/explain
 */
export interface AudienceQualityEvidence {
  // Proxy signals
  overlap_pressure_0_1: number;
  bot_risk_0_1: number;
  purity_0_1: number;
  smart_followers_proxy_0_1: number;

  // Raw inputs used
  inputs_used: string[];
  notes: string[];
}

/**
 * Full Audience Quality result
 */
export interface AudienceQualityResult {
  account_id: string;

  // Main score
  audience_quality_score_0_1: number;

  // Component scores
  smart_followers_score_0_1: number;  // proxy now, real later
  top_followers_count: number;        // 0 now (real from Twitter later)
  tier1_share_0_1: number;            // neutral now
  bot_share_0_1: number;              // proxy now
  audience_purity_score_0_1: number;  // proxy now

  confidence: ConfidenceLevel;

  evidence: AudienceQualityEvidence;

  explain: {
    summary: string;
    drivers: string[];
    concerns: string[];
    recommendations: string[];
  };

  meta: {
    version: string;
    computed_at: string;
    data_mode: "proxy" | "twitter" | "hybrid";
  };
}

/**
 * Batch result
 */
export interface AudienceQualityBatchResult {
  version: string;
  computed_at: string;
  results: AudienceQualityResult[];
  stats: {
    total: number;
    avg_quality: number;
    high_quality_count: number;  // >= 0.70
    risky_count: number;         // < 0.40
  };
}
