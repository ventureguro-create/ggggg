/**
 * Twitter Score Configuration v1.0
 * 
 * All weights, thresholds, and tunable parameters in one place.
 * Can be overridden via Admin panel.
 */

export const TWITTER_SCORE_VERSION = "1.0.0";

export interface TwitterScoreConfigType {
  version: string;
  
  weights: {
    influence: number;
    quality: number;
    trend: number;
    network_proxy: number;
    consistency: number;
  };
  
  normalize: {
    influence_max: number;
    quality_max: number;
    signal_noise_max: number;
    velocity_cap: number;
    acceleration_cap: number;
  };
  
  trend: {
    k_velocity: number;
    k_acceleration: number;
  };
  
  proxies: {
    network_from_early_signal: Record<string, number>;
    consistency_default: number;
  };
  
  penalties: {
    risk_level: Record<string, number>;
    red_flags: Record<string, number>;
    max_total_penalty: number;
  };
  
  grades: readonly { grade: string; min: number }[];
  
  confidence: {
    required_for_high: readonly string[];
    required_for_med: readonly string[];
  };
}

export const twitterScoreConfig: TwitterScoreConfigType = {
  version: TWITTER_SCORE_VERSION,

  // Component weights (sum = 1.0)
  weights: {
    influence: 0.35,
    quality: 0.20,
    trend: 0.20,
    network_proxy: 0.15,
    consistency: 0.10,
  },

  // Normalization ranges
  normalize: {
    influence_max: 1000,
    quality_max: 1000,
    signal_noise_max: 10,
    velocity_cap: 40,        // pts/day (up/down)
    acceleration_cap: 25,    // pts/day delta
  },

  // Trend calculation
  trend: {
    k_velocity: 0.65,
    k_acceleration: 0.35,
  },

  // Proxy values until Twitter data available
  proxies: {
    network_from_early_signal: {
      none: 0.45,
      rising: 0.60,
      breakout: 0.70,
    },
    consistency_default: 0.55,
  },

  // Penalty configuration
  penalties: {
    risk_level: { 
      LOW: 0.00, 
      MED: 0.10, 
      HIGH: 0.25 
    },
    red_flags: {
      LIKE_HEAVY: 0.05,
      REPOST_FARM: 0.12,
      VIRAL_SPIKE: 0.06,
      BOT_LIKE_PATTERN: 0.15,
      AUDIENCE_OVERLAP: 0.10,
      FAKE_ENGAGEMENT: 0.15,
      SUSPICIOUS_GROWTH: 0.08,
      LOW_REPLY_RATIO: 0.04,
    },
    max_total_penalty: 0.35,
  },

  // Grade thresholds
  grades: [
    { grade: "S", min: 850 },
    { grade: "A", min: 700 },
    { grade: "B", min: 550 },
    { grade: "C", min: 400 },
    { grade: "D", min: 0 },
  ] as const,

  // Confidence requirements
  confidence: {
    required_for_high: ["base_influence", "x_score", "velocity", "acceleration"] as const,
    required_for_med: ["base_influence", "x_score"] as const,
  },
};

/**
 * Get config (can be extended to load from DB/env)
 */
export function getTwitterScoreConfig(): TwitterScoreConfigType {
  return twitterScoreConfig;
}

/**
 * Update config (for admin panel)
 */
export function updateTwitterScoreConfig(updates: Partial<TwitterScoreConfigType>): void {
  Object.assign(twitterScoreConfig, updates);
  console.log('[TwitterScore] Config updated:', twitterScoreConfig.version);
}
