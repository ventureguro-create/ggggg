/**
 * Drift v1 Types
 * Phase 6.0 — Environment Observation Layer
 * 
 * PURPOSE: Track environment changes without modifying system behavior
 * NO ML, NO AUTO-FIX — just observe and report
 */

// ============================================================
// DRIFT LEVELS
// ============================================================

export type DriftLevel = 'OK' | 'LOW' | 'MEDIUM' | 'HIGH';

export type DriftRecommendation = 
  | 'NONE'              // All stable
  | 'WARN'              // Minor drift, continue with caution
  | 'REVIEW_REQUIRED'   // Significant drift, admin review needed
  | 'FREEZE_REQUIRED';  // Major drift, freeze system before changes

// ============================================================
// METRIC DRIFT
// ============================================================

export interface DriftMetricResult {
  key: string;
  label: string;
  baseline: number;
  current: number;
  delta_pct: number;
  level: DriftLevel;
  unit?: string;        // '%', 'pts', 'count'
  direction?: 'UP' | 'DOWN' | 'STABLE';
}

export interface DriftSection {
  level: DriftLevel;
  metrics: DriftMetricResult[];
  issues: string[];     // Human-readable issues
}

// ============================================================
// DRIFT REPORT
// ============================================================

export interface DriftReport {
  // Baseline reference
  snapshot: string;           // e.g., 'FREEZE_v1.0'
  snapshot_date: string;      // When baseline was taken
  window_days: number;        // Rolling window for current data
  
  // Overall assessment
  overall: DriftLevel;
  recommendation: DriftRecommendation;
  
  // Three drift dimensions
  data: DriftSection;         // Data Drift — metric distributions
  network: DriftSection;      // Network Drift — graph structure  
  concept: DriftSection;      // Concept Drift — signal meaning
  
  // Metadata
  generated_at: string;
  alerts_blocked: boolean;    // Whether drift blocks live expansion
}

// ============================================================
// BASELINE SNAPSHOT
// ============================================================

export interface BaselineSnapshot {
  id: string;
  name: string;
  created_at: string;
  
  // Data metrics (expected distributions)
  data_metrics: {
    engagement_rate_p50: number;
    engagement_rate_p90: number;
    audience_purity_p50: number;
    confidence_avg: number;
    twitter_score_avg: number;
    smart_followers_pct: number;
    overlap_pressure_avg: number;
  };
  
  // Network metrics (graph structure)
  network_metrics: {
    avg_hops_to_elite: number;
    elite_exposure_pct: number;
    authority_gini: number;
    avg_degree: number;
    cluster_density: number;
  };
  
  // Concept metrics (signal effectiveness)
  concept_metrics: {
    alert_fp_rate: number;
    aqm_high_suppress_rate: number;
    fatigue_avg: number;
    disagreement_rate: number;  // rules vs AQM
  };
}

// ============================================================
// DRIFT THRESHOLDS (configurable)
// ============================================================

export interface DriftThresholds {
  low: number;    // % change to trigger LOW
  medium: number; // % change to trigger MEDIUM
  high: number;   // % change to trigger HIGH
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  low: 15,      // 15% change
  medium: 30,   // 30% change
  high: 50,     // 50% change
};

// ============================================================
// DRIFT EVENTS (for audit)
// ============================================================

export interface DriftEvent {
  id: string;
  type: 'DATA_DRIFT' | 'NETWORK_DRIFT' | 'CONCEPT_DRIFT';
  level: DriftLevel;
  metric: string;
  delta_pct: number;
  baseline: number;
  current: number;
  detected_at: string;
  resolved_at?: string;
  notes?: string;
}

console.log('[Drift] Types loaded (Phase 6.0 — Observation Layer)');
