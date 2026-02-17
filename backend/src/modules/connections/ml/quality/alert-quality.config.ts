/**
 * Alert Quality Model Config (Phase 5.1)
 */

export interface AQMConfig {
  enabled: boolean;
  shadow_ml_enabled: boolean;
  min_confidence_score: number;
  weights: {
    early_signal: number;
    confidence: number;
    smart_followers: number;
    authority: number;
    alert_fatigue: number;
  };
  thresholds: {
    high: number;
    medium: number;
    low: number;
  };
  low_priority_label: boolean;
  version: string;
}

export const DEFAULT_AQM_CONFIG: AQMConfig = {
  enabled: true,
  shadow_ml_enabled: false,
  min_confidence_score: 65,
  weights: {
    early_signal: 0.30,
    confidence: 0.25,
    smart_followers: 0.20,
    authority: 0.15,
    alert_fatigue: 0.10,
  },
  thresholds: {
    high: 0.75,
    medium: 0.55,
    low: 0.40,
  },
  low_priority_label: true,
  version: '1.0.0',
};
