/**
 * ML2 Types & Contracts
 * Phase 5.3 — ML2 Shadow Enable
 * 
 * ML2 is the "smart" layer that learns from feedback
 * In SHADOW mode: observe only, no impact on decisions
 */

// ============================================================
// ML2 MODE
// ============================================================

export type Ml2Mode = 'OFF' | 'SHADOW' | 'ACTIVE_SAFE';

// ============================================================
// ML2 CONFIG
// ============================================================

export interface Ml2Config {
  mode: Ml2Mode;
  min_prob_downrank: number;      // 0-1, threshold for downrank suggestion
  min_prob_suppress: number;      // 0-1, threshold for suppress suggestion
  model_version: string;          // active model version
  enabled_alert_types: string[];  // which alert types ML2 evaluates
}

export const DEFAULT_ML2_CONFIG: Ml2Config = {
  mode: 'SHADOW',
  min_prob_downrank: 0.55,
  min_prob_suppress: 0.40,
  model_version: 'ml2-shadow-v1',
  enabled_alert_types: ['EARLY_BREAKOUT', 'STRONG_ACCELERATION', 'TREND_REVERSAL'],
};

// ============================================================
// ML2 FEATURES (input to model)
// ============================================================

export interface Ml2Features {
  // Core signal quality
  early_signal_0_1: number;
  confidence_0_1: number;
  
  // Network quality
  smart_followers_0_1: number;
  authority_0_1: number;
  audience_quality_0_1: number;
  hops_0_1: number;
  
  // Behavior/risk
  fatigue_0_1: number;
  pattern_risk_0_1: number;
  drift_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  
  // NEW: Extended AQE features (Phase A2)
  aqe_real_pct_0_1?: number;       // 0..1 real audience percentage
  aqe_bot_pressure_0_1?: number;   // 0..1 bot pressure percentage
  aqe_confidence_0_1?: number;     // 0..1 AQE confidence
  aqe_level?: 'HIGH' | 'MIXED' | 'LOW' | 'UNKNOWN';
  aqe_anomaly?: boolean;           // growth anomaly detected
  
  // Meta
  alert_type: string;
  profile: 'retail' | 'influencer' | 'whale';
}

// ============================================================
// ML2 PREDICTION RESULT
// ============================================================

export type Ml2Label = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';
export type Ml2Recommendation = 'KEEP' | 'DOWNRANK' | 'SUPPRESS_SUGGEST';

export interface Ml2PredictionResult {
  version: string;
  prob_useful: number;            // 0-1, probability that alert is useful
  label: Ml2Label;
  recommendation: Ml2Recommendation;
  explain: {
    positives: Array<{ key: string; impact: number; note: string }>;
    negatives: Array<{ key: string; impact: number; note: string }>;
    summary: string;
  };
}

// ============================================================
// ML2 SHADOW LOG (what would ML2 have done)
// ============================================================

export interface Ml2ShadowLogEntry {
  alert_id: string;
  ts: Date;
  
  // Rule engine decision (actual)
  rule_decision: 'SEND' | 'SUPPRESS' | 'BLOCK';
  
  // ML2 prediction (shadow)
  ml2_prob: number;
  ml2_label: Ml2Label;
  ml2_recommendation: Ml2Recommendation;
  
  // NEW: AQE snapshot for analysis
  aqe_snapshot?: {
    real_pct?: number;
    bot_pressure?: number;
    confidence?: number;
    level?: 'HIGH' | 'MIXED' | 'LOW' | 'UNKNOWN';
    anomaly?: boolean;
  };
  
  // NEW: AQE-related tags
  aqe_tags?: string[];  // e.g. ['AQE_LOW_AUDIENCE', 'AQE_BOT_PRESSURE']
  
  // Comparison
  would_change: boolean;          // true if ML2 disagrees
  change_type?: 'DOWNRANK' | 'SUPPRESS';
  note: string;
}

// ============================================================
// ML2 FEEDBACK (dataset for training)
// ============================================================

export type Ml2FeedbackLabel = 'TP' | 'FP' | 'IGNORED' | 'USEFUL' | 'NOT_USEFUL';

export interface Ml2FeedbackEvent {
  alert_id: string;
  feature_hash: string;
  label: Ml2FeedbackLabel;
  actor: 'admin' | 'user';
  note?: string;
  created_at: Date;
}

// ============================================================
// ML2 SHADOW STATS
// ============================================================

export interface Ml2ShadowStats {
  total: number;
  agreement_rate: number;         // % where ML2 agrees with rule
  would_suppress: number;         // % ML2 would suppress
  would_downrank: number;         // % ML2 would downrank
  noise_detected: number;         // % classified as NOISE
  by_alert_type: Record<string, {
    total: number;
    agreement_rate: number;
  }>;
}

console.log('[ML2] Types loaded (Phase 5.3 — Shadow Enable)');
