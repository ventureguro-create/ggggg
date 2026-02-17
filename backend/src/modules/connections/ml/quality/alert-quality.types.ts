/**
 * Alert Quality Model Types (Phase 5.1)
 */

export type AlertType = 'EARLY_BREAKOUT' | 'STRONG_ACCELERATION' | 'TREND_REVERSAL';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type AQMLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';
export type AQMRecommendation = 'SEND' | 'SEND_LOW_PRIORITY' | 'SUPPRESS';
export type Mode = 'MOCK' | 'PILOT' | 'LIVE';

export interface AlertContext {
  alert_type: AlertType;

  scores: {
    twitter_score: number;
    influence: number;
    quality: number;
    trend: number;
    network: number;
    consistency: number;
  };

  confidence: {
    score: number;
    level: ConfidenceLevel;
  };

  early_signal: {
    score: number;
    velocity: number;
    acceleration: number;
  };

  network: {
    authority: number;
    hops_to_elite: number;
    elite_exposure_pct: number;
  };

  audience: {
    smart_followers_pct: number;
    purity_score: number;
  };

  temporal: {
    last_alert_hours_ago: number;
    alert_count_24h: number;
  };

  meta: {
    mode: Mode;
    pilot_account: boolean;
    source_id?: string;
  };
}

export interface AlertQualityExplain {
  top_positive_factors: string[];
  top_negative_factors: string[];
  reason: string;
}

export interface AlertQualityResult {
  probability: number;
  label: AQMLabel;
  recommendation: AQMRecommendation;
  explain: AlertQualityExplain;
  components?: {
    deterministic: number;
    ml?: number;
  };
  gates?: {
    confidence_blocked?: boolean;
    throttled?: boolean;
  };
}
