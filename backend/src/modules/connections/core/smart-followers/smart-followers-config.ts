/**
 * Smart Followers Configuration
 */

export const SMART_FOLLOWERS_VERSION = '1.0.0';

export interface SmartFollowersConfig {
  version: string;
  
  // Tier multipliers (authority weight amplifiers)
  tier_multiplier: Record<string, number>;
  
  // How many top followers to return
  top_n: number;
  
  // Score normalization
  normalize: {
    method: 'logistic' | 'minmax';
    logistic: {
      k: number; // score = 1 - exp(-k * total_weight)
      clamp: boolean;
    };
    minmax: {
      min_weight: number;
      max_weight: number;
      clamp: boolean;
    };
  };
  
  // Follower value index config
  fvi: {
    log_base: number;
  };
  
  // Integration weights for twitter score quality component
  integration: {
    quality_mix: {
      engagement: number;
      consistency: number;
      smart_followers: number;
    };
  };
  
  // Warning thresholds
  thresholds: {
    elite_share_high: number;
    elite_share_low: number;
    top_concentration_high: number;
    small_followers_n: number;
  };
  
  enabled: boolean;
}

export const smartFollowersConfig: SmartFollowersConfig = {
  version: SMART_FOLLOWERS_VERSION,

  // Tier multipliers (tune in admin)
  tier_multiplier: {
    elite: 1.5,
    high: 1.25,
    upper_mid: 1.1,
    mid: 1.0,
    low_mid: 0.85,
    low: 0.75,
  },

  top_n: 10,

  // Score normalization
  normalize: {
    method: 'logistic',
    logistic: {
      k: 0.35,
      clamp: true,
    },
    minmax: {
      min_weight: 0,
      max_weight: 40,
      clamp: true,
    },
  },

  // Follower value index
  fvi: {
    log_base: Math.E,
  },

  // Integration weights
  integration: {
    quality_mix: {
      engagement: 0.50,
      consistency: 0.30,
      smart_followers: 0.20,
    },
  },

  // Thresholds
  thresholds: {
    elite_share_high: 0.55,
    elite_share_low: 0.10,
    top_concentration_high: 0.70,
    small_followers_n: 200,
  },
  
  enabled: true,
};

export function updateSmartFollowersConfig(updates: Partial<SmartFollowersConfig>): SmartFollowersConfig {
  if (updates.tier_multiplier) {
    Object.assign(smartFollowersConfig.tier_multiplier, updates.tier_multiplier);
  }
  if (updates.normalize) {
    Object.assign(smartFollowersConfig.normalize, updates.normalize);
  }
  if (updates.integration) {
    Object.assign(smartFollowersConfig.integration, updates.integration);
  }
  if (updates.thresholds) {
    Object.assign(smartFollowersConfig.thresholds, updates.thresholds);
  }
  if (updates.top_n !== undefined) {
    smartFollowersConfig.top_n = updates.top_n;
  }
  if (updates.enabled !== undefined) {
    smartFollowersConfig.enabled = updates.enabled;
  }
  return smartFollowersConfig;
}

export function getSmartFollowersConfig(): SmartFollowersConfig {
  return { ...smartFollowersConfig };
}
