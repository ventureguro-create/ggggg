/**
 * Network Paths Configuration
 * 
 * Admin-tunable parameters for path analysis
 */

export const PATHS_VERSION = '1.0.0';

export interface PathsConfig {
  version: string;
  max_depth: number;
  
  // How hops reduce contribution
  hop_decay: Record<number, number>;
  
  // Eligible targets
  target_thresholds: {
    elite_min_authority: number;
    high_min_authority: number;
  };
  
  // Contribution normalization
  normalize: {
    method: 'logistic';
    logistic_k: number;
  };
  
  // Limits
  limits: {
    targets_top_n: number;
    paths_top_n: number;
  };
  
  // Exposure weights
  exposure: {
    w_reachable_elite: number;
    w_reachable_high: number;
    w_inverse_avg_hops: number;
  };
  
  // Exposure tier thresholds
  exposure_tiers: {
    elite: number;
    strong: number;
    moderate: number;
  };
  
  enabled: boolean;
}

export const pathsConfig: PathsConfig = {
  version: PATHS_VERSION,

  max_depth: 3,

  // How hops reduce contribution
  hop_decay: {
    1: 1.0,
    2: 0.72,
    3: 0.52,
  },

  // Eligible targets
  target_thresholds: {
    elite_min_authority: 0.80,
    high_min_authority: 0.65,
  },

  // Contribution normalization
  normalize: {
    method: 'logistic',
    logistic_k: 0.9,
  },

  // Limits
  limits: {
    targets_top_n: 15,
    paths_top_n: 6,
  },

  // Exposure weights
  exposure: {
    w_reachable_elite: 0.40,
    w_reachable_high: 0.35,
    w_inverse_avg_hops: 0.25,
  },

  // Exposure tier thresholds
  exposure_tiers: {
    elite: 0.80,
    strong: 0.55,
    moderate: 0.30,
  },
  
  enabled: true,
};

export function updatePathsConfig(updates: Partial<PathsConfig>): PathsConfig {
  if (updates.max_depth !== undefined) pathsConfig.max_depth = updates.max_depth;
  if (updates.hop_decay) Object.assign(pathsConfig.hop_decay, updates.hop_decay);
  if (updates.target_thresholds) Object.assign(pathsConfig.target_thresholds, updates.target_thresholds);
  if (updates.normalize) Object.assign(pathsConfig.normalize, updates.normalize);
  if (updates.limits) Object.assign(pathsConfig.limits, updates.limits);
  if (updates.exposure) Object.assign(pathsConfig.exposure, updates.exposure);
  if (updates.exposure_tiers) Object.assign(pathsConfig.exposure_tiers, updates.exposure_tiers);
  if (updates.enabled !== undefined) pathsConfig.enabled = updates.enabled;
  return pathsConfig;
}

export function getPathsConfig(): PathsConfig {
  return { ...pathsConfig };
}
