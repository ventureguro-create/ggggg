/**
 * Connections Scoring Config v0
 * 
 * All tunable parameters in one place.
 * This is MODEL CONFIG, not admin settings.
 * 
 * Can be:
 * - Versioned (v0, v1, v2)
 * - Snapshotted for A/B testing
 * - Compared between runs
 */

export const ConnectionsScoringConfig = {
  version: 'v0.2',
  
  // Time windows
  windows: {
    default_days: 30,
    supported: [7, 14, 30, 90],
  },

  // Proxy weights for views estimation
  proxy_weights: {
    like: 40,
    repost: 80,
    reply: 120,
  },

  // Engagement quality weights
  engagement_weights: {
    like: 1.0,
    repost: 2.0,
    reply: 3.0,
    exp_k: 20, // for 1 - exp(-k*x)
  },

  // Posting consistency
  posting: {
    max_posts_per_day: 5, // normalization cap
    low_activity_threshold: 0.05, // posts/day below this = LOW_ACTIVITY flag
  },

  // Volatility thresholds
  volatility: {
    low: 0.75,
    moderate: 1.5,
    // > moderate = high
  },

  // Reach efficiency
  reach: {
    rve_cap_views: 1_000_000, // saturation point for RVE score
  },

  // Score component weights
  scores: {
    x: {
      pc: 0.35,    // posting_consistency
      es: 0.35,    // engagement_stability
      eq: 0.20,    // engagement_quality
      // remaining 0.10 is implicit penalty space
      penalty_cap: 0.4,
    },
    influence: {
      rve: 0.35,   // real_views_estimate
      re: 0.20,    // reach_efficiency
      eq: 0.25,    // engagement_quality
      authority: 0.10,  // stub for now
      // remaining 0.10 is implicit penalty space
      penalty_cap: 0.6,
    },
  },

  // Red flag detection thresholds
  red_flags: {
    like_heavy: {
      like_rate: 0.02,      // > 2%
      repost_rate: 0.0005,  // < 0.05%
      reply_rate: 0.0002,   // < 0.02%
      severity: 2,
    },
    repost_farm: {
      repost_rate: 0.01,    // > 1%
      like_rate: 0.002,     // < 0.2%
      severity: 2,
    },
    viral_spike: {
      ratio: 10,            // max_views / median_views > 10
      min_posts: 5,
      severity: 1,
    },
    growth_no_reach: {
      growth: 0.25,         // > 25% follower growth
      reach_efficiency: 0.2, // < 20% RE
      severity: 3,
    },
    low_stability: {
      es: 0.25,             // engagement_stability < 25%
      severity: 1,
    },
    low_activity: {
      posts_per_day: 0.05,
      severity: 1,
    },
  },

  // Risk level thresholds (sum of severities)
  risk_levels: {
    low_max: 2,      // 0-2 = low
    medium_max: 5,   // 3-5 = medium
    // > 5 = high
  },

  // Signal/Noise calculation
  signal_noise: {
    signal_weights: {
      es: 0.5,
      pc: 0.3,
      eq: 0.2,
    },
    noise_divisors: {
      risk: 10,
      volatility: 3,
    },
  },
};

// Type for config
export type ScoringConfig = typeof ConnectionsScoringConfig;

// Get config (for future: could load from DB/file)
export function getScoringConfig(): ScoringConfig {
  return ConnectionsScoringConfig;
}

// Override config for testing/A/B
export function createConfigOverride(overrides: Partial<ScoringConfig>): ScoringConfig {
  return {
    ...ConnectionsScoringConfig,
    ...overrides,
    version: `${ConnectionsScoringConfig.version}-override`,
  };
}
