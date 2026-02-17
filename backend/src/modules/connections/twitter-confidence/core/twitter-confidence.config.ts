/**
 * Twitter Confidence Score Configuration
 * 
 * Admin-tunable parameters for confidence scoring.
 * 
 * PHASE 4.1.6 — Twitter Confidence Score v1.0
 */

import type { TwitterConfidenceLabel } from '../contracts/index.js';

/**
 * Configuration structure
 */
export interface TwitterConfidenceConfig {
  version: string;
  
  // Component weights (must sum to 1.0)
  weights: {
    freshness: number;
    consistency: number;
    coverage: number;
    anomaly_health: number;
    source_trust: number;
  };
  
  // Freshness calculation
  freshness: {
    half_life_hours: number;  // Data value halves every N hours
  };
  
  // Label thresholds
  labels: {
    high: number;     // >= this = HIGH
    medium: number;   // >= this = MEDIUM
    low: number;      // >= this = LOW, below = CRITICAL
  };
  
  // Coverage weights
  coverage: {
    follow_graph: number;
    engagement: number;
    profile_meta: number;
  };
  
  // Anomaly penalties
  anomaly_penalties: {
    spike: number;
    duplicates: number;
    suspicious_ratios: number;
    rate_limit: number;
  };
  
  // Dampening settings
  dampening: {
    enabled: boolean;
    apply_from_label: TwitterConfidenceLabel;  // Apply dampening from this label down
    min_multiplier: number;  // Never dampen below this (0.35 = keep at least 35%)
  };
  
  // Alert policy
  policy: {
    block_alerts_below: number;  // Block alerts if confidence < this
    warn_in_alerts_below: number;  // Add warning if confidence < this
  };
}

/**
 * Default configuration
 */
export const DEFAULT_TWITTER_CONFIDENCE_CONFIG: TwitterConfidenceConfig = {
  version: '1.0.0',
  
  weights: {
    freshness: 0.25,
    consistency: 0.25,
    coverage: 0.20,
    anomaly_health: 0.20,
    source_trust: 0.10,
  },
  
  freshness: {
    half_life_hours: 24,
  },
  
  labels: {
    high: 0.85,
    medium: 0.65,
    low: 0.40,
  },
  
  coverage: {
    follow_graph: 0.40,
    engagement: 0.40,
    profile_meta: 0.20,
  },
  
  anomaly_penalties: {
    spike: 0.15,
    duplicates: 0.10,
    suspicious_ratios: 0.25,
    rate_limit: 0.15,
  },
  
  dampening: {
    enabled: true,
    apply_from_label: 'MEDIUM',
    min_multiplier: 0.35,
  },
  
  policy: {
    block_alerts_below: 0.50,
    warn_in_alerts_below: 0.70,
  },
};

// Runtime config (mutable by admin)
let confidenceConfig: TwitterConfidenceConfig = { ...DEFAULT_TWITTER_CONFIDENCE_CONFIG };

/**
 * Get current config
 */
export function getConfidenceConfig(): TwitterConfidenceConfig {
  return { ...confidenceConfig };
}

/**
 * Update config (admin)
 */
export function updateConfidenceConfig(partial: Partial<TwitterConfidenceConfig>): TwitterConfidenceConfig {
  confidenceConfig = {
    ...confidenceConfig,
    ...partial,
    weights: { ...confidenceConfig.weights, ...(partial.weights || {}) },
    freshness: { ...confidenceConfig.freshness, ...(partial.freshness || {}) },
    labels: { ...confidenceConfig.labels, ...(partial.labels || {}) },
    coverage: { ...confidenceConfig.coverage, ...(partial.coverage || {}) },
    anomaly_penalties: { ...confidenceConfig.anomaly_penalties, ...(partial.anomaly_penalties || {}) },
    dampening: { ...confidenceConfig.dampening, ...(partial.dampening || {}) },
    policy: { ...confidenceConfig.policy, ...(partial.policy || {}) },
  };
  
  console.log('[TwitterConfidence] Config updated:', {
    version: confidenceConfig.version,
    dampening: confidenceConfig.dampening.enabled,
    block_alerts_below: confidenceConfig.policy.block_alerts_below,
  });
  
  return { ...confidenceConfig };
}

/**
 * Reset to defaults
 */
export function resetConfidenceConfig(): TwitterConfidenceConfig {
  confidenceConfig = { ...DEFAULT_TWITTER_CONFIDENCE_CONFIG };
  return { ...confidenceConfig };
}
