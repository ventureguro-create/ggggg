/**
 * Drift v1 Constants
 * Phase 6.0 — Environment Observation Layer
 */

// Metric definitions for each drift type
export const DATA_DRIFT_METRICS = [
  { key: 'engagement_rate_p50', label: 'Engagement Rate (P50)', unit: '%', baseline_key: 'engagement_rate_p50' },
  { key: 'audience_purity_p50', label: 'Audience Purity (P50)', unit: '%', baseline_key: 'audience_purity_p50' },
  { key: 'confidence_avg', label: 'Confidence Average', unit: '', baseline_key: 'confidence_avg' },
  { key: 'twitter_score_avg', label: 'Twitter Score Average', unit: 'pts', baseline_key: 'twitter_score_avg' },
  { key: 'smart_followers_pct', label: 'Smart Followers %', unit: '%', baseline_key: 'smart_followers_pct' },
  { key: 'overlap_pressure_avg', label: 'Overlap Pressure', unit: '', baseline_key: 'overlap_pressure_avg' },
];

export const NETWORK_DRIFT_METRICS = [
  { key: 'avg_hops_to_elite', label: 'Avg Hops to Elite', unit: 'hops', baseline_key: 'avg_hops_to_elite', inverted: true },
  { key: 'elite_exposure_pct', label: 'Elite Exposure', unit: '%', baseline_key: 'elite_exposure_pct' },
  { key: 'authority_gini', label: 'Authority Concentration', unit: '', baseline_key: 'authority_gini', inverted: true },
  { key: 'avg_degree', label: 'Average Degree', unit: '', baseline_key: 'avg_degree' },
  { key: 'cluster_density', label: 'Cluster Density', unit: '', baseline_key: 'cluster_density' },
];

export const CONCEPT_DRIFT_METRICS = [
  { key: 'alert_fp_rate', label: 'False Positive Rate', unit: '%', baseline_key: 'alert_fp_rate', inverted: true },
  { key: 'aqm_high_suppress_rate', label: 'AQM HIGH → SUPPRESS Rate', unit: '%', baseline_key: 'aqm_high_suppress_rate', inverted: true },
  { key: 'fatigue_avg', label: 'Alert Fatigue', unit: '', baseline_key: 'fatigue_avg', inverted: true },
  { key: 'disagreement_rate', label: 'Rules vs AQM Disagreement', unit: '%', baseline_key: 'disagreement_rate', inverted: true },
];

// Level thresholds (% change from baseline)
export const DRIFT_LEVEL_THRESHOLDS = {
  OK: 10,       // 0-10% = OK
  LOW: 20,      // 10-20% = LOW
  MEDIUM: 35,   // 20-35% = MEDIUM
  HIGH: 50,     // 35%+ = HIGH
};

// Section aggregation rules
export const SECTION_LEVEL_RULES = {
  // If any metric is HIGH → section is HIGH
  // If ≥2 metrics are MEDIUM → section is HIGH
  // If any metric is MEDIUM → section is MEDIUM
  // Otherwise follow max level
};

// Recommendation thresholds
export const RECOMMENDATION_RULES = {
  FREEZE_REQUIRED: {
    condition: 'overall === HIGH OR concept.level === HIGH',
  },
  REVIEW_REQUIRED: {
    condition: 'overall === MEDIUM AND (data.level === HIGH OR network.level === HIGH)',
  },
  WARN: {
    condition: 'any section === MEDIUM',
  },
  NONE: {
    condition: 'all sections === OK or LOW',
  },
};

console.log('[Drift] Constants loaded');
