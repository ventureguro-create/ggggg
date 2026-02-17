/**
 * Pattern Detection Config (Phase 5.2)
 */

export interface PatternsConfig {
  enabled: boolean;
  
  // A: Like/Reply Imbalance
  imbalance: {
    enabled: boolean;
    threshold: number;      // likes / (replies + reposts + 1)
    min_likes: number;      // minimum likes to trigger
  };
  
  // B: Spike Pump
  spike: {
    enabled: boolean;
    z_threshold: number;    // z-score threshold
    min_engagement: number; // minimum engagement to consider
  };
  
  // C: Cross-Audience Farm
  overlap: {
    enabled: boolean;
    pressure_threshold: number;
    purity_min: number;
  };
  
  // Severity thresholds
  severity: {
    high_risk: number;      // risk_score >= this = HIGH
    medium_risk: number;    // risk_score >= this = MEDIUM
  };
  
  version: string;
}

export const DEFAULT_PATTERNS_CONFIG: PatternsConfig = {
  enabled: true,
  
  imbalance: {
    enabled: true,
    threshold: 10,          // likes 10x more than replies+reposts
    min_likes: 100,
  },
  
  spike: {
    enabled: true,
    z_threshold: 2.5,       // 2.5 standard deviations
    min_engagement: 50,
  },
  
  overlap: {
    enabled: true,
    pressure_threshold: 0.4,
    purity_min: 50,
  },
  
  severity: {
    high_risk: 70,
    medium_risk: 40,
  },
  
  version: '1.0.0',
};
