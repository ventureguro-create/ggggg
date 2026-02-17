/**
 * Audience Quality Configuration v1.0
 * 
 * All weights, thresholds, and tunable parameters.
 * Can be overridden via Admin panel.
 */

export const AUDIENCE_QUALITY_VERSION = "1.0.0";

export interface AudienceQualityConfigType {
  version: string;
  
  weights: {
    purity: number;
    smart_followers_proxy: number;
    signal_quality: number;
    consistency: number;
  };
  
  normalize: {
    x_score_max: number;
    signal_noise_max: number;
    shared_cap: number;
  };
  
  overlap: {
    jaccard_soft: number;
    jaccard_hard: number;
    shared_soft: number;
    shared_hard: number;
  };
  
  botRisk: {
    red_flags: Record<string, number>;
    max_from_flags: number;
  };
  
  neutral: {
    tier1_share_0_1: number;
    top_followers_count: number;
  };
  
  confidence: {
    min_overlap_samples_for_high: number;
    min_overlap_samples_for_med: number;
  };
  
  quality_thresholds: {
    high: number;      // >= this = high quality
    medium: number;    // >= this = medium quality
    low: number;       // < this = risky
  };
}

export const audienceQualityConfig: AudienceQualityConfigType = {
  version: AUDIENCE_QUALITY_VERSION,

  // Weights for final audience_quality_score
  weights: {
    purity: 0.45,
    smart_followers_proxy: 0.30,
    signal_quality: 0.15,  // x_score + signal_noise
    consistency: 0.10,
  },

  // Normalization ranges
  normalize: {
    x_score_max: 1000,
    signal_noise_max: 10,
    shared_cap: 250,  // cap for shared engaged ids influence
  },

  // Overlap -> pressure mapping
  overlap: {
    jaccard_soft: 0.10,   // below this = low pressure
    jaccard_hard: 0.25,   // above this = high pressure
    shared_soft: 25,      // shared engaged ids thresholds
    shared_hard: 80,
  },

  // Bot risk from red flags
  botRisk: {
    red_flags: {
      AUDIENCE_OVERLAP: 0.20,
      BOT_LIKE_PATTERN: 0.30,
      REPOST_FARM: 0.25,
      VIRAL_SPIKE: 0.10,
      LIKE_HEAVY: 0.10,
      FAKE_ENGAGEMENT: 0.25,
      SUSPICIOUS_GROWTH: 0.15,
    },
    max_from_flags: 0.75,
  },

  // Neutral defaults (until Twitter follower/follow arrives)
  neutral: {
    tier1_share_0_1: 0.50,
    top_followers_count: 0,
  },

  // Confidence requirements
  confidence: {
    min_overlap_samples_for_high: 8,
    min_overlap_samples_for_med: 3,
  },

  // Quality classification thresholds
  quality_thresholds: {
    high: 0.70,
    medium: 0.50,
    low: 0.40,
  },
};

/**
 * Get current config
 */
export function getAudienceQualityConfig(): AudienceQualityConfigType {
  return audienceQualityConfig;
}

/**
 * Update config (for admin panel)
 */
export function updateAudienceQualityConfig(updates: Partial<AudienceQualityConfigType>): void {
  if (updates.weights) Object.assign(audienceQualityConfig.weights, updates.weights);
  if (updates.overlap) Object.assign(audienceQualityConfig.overlap, updates.overlap);
  if (updates.botRisk?.red_flags) Object.assign(audienceQualityConfig.botRisk.red_flags, updates.botRisk.red_flags);
  if (updates.neutral) Object.assign(audienceQualityConfig.neutral, updates.neutral);
  if (updates.confidence) Object.assign(audienceQualityConfig.confidence, updates.confidence);
  console.log('[AudienceQuality] Config updated:', audienceQualityConfig.version);
}
