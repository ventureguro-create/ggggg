/**
 * Drift v1 Report Service
 * Phase 6.0 — Environment Observation Layer
 * 
 * Builds the full drift report by:
 * 1. Getting baseline (FREEZE snapshot)
 * 2. Collecting current metrics
 * 3. Computing drift for each dimension
 * 4. Generating recommendations
 */

import type { DriftReport, DriftRecommendation, DriftLevel } from './drift.types.js';
import { 
  getBaseline, 
  getBaselineDataMetrics, 
  getBaselineNetworkMetrics, 
  getBaselineConceptMetrics 
} from './drift.baseline.service.js';
import { 
  computeMetricDrift, 
  buildSection, 
  computeOverallLevel 
} from './drift.compute.service.js';
import { 
  DATA_DRIFT_METRICS, 
  NETWORK_DRIFT_METRICS, 
  CONCEPT_DRIFT_METRICS 
} from './drift.constants.js';

// ============================================================
// CURRENT METRICS COLLECTION
// ============================================================

/**
 * Get current data metrics from system
 * In production, this would query real data
 * For now, using simulated current values
 */
function getCurrentDataMetrics(): Record<string, number> {
  // TODO: Replace with actual queries to connections store
  // These simulate slight drift from baseline
  return {
    engagement_rate_p50: 0.028,         // ↓ 12.5% from 0.032
    engagement_rate_p90: 0.082,         // ↓ 7.8%
    audience_purity_p50: 0.68,          // ↓ 5.5%
    confidence_avg: 0.71,               // ↓ 9% from 0.78
    twitter_score_avg: 589,             // ↓ 3.7%
    smart_followers_pct: 0.21,          // ↓ 12.5%
    overlap_pressure_avg: 0.22,         // ↑ 22% from 0.18
  };
}

/**
 * Get current network metrics
 */
function getCurrentNetworkMetrics(): Record<string, number> {
  // TODO: Replace with graph queries
  return {
    avg_hops_to_elite: 2.5,             // ↑ 8.7% (worse)
    elite_exposure_pct: 0.29,           // ↓ 14.7% (worse)
    authority_gini: 0.48,               // ↑ 14.3% (more concentrated)
    avg_degree: 7.9,                    // ↓ 9.2%
    cluster_density: 0.31,              // ↑ 10.7%
  };
}

/**
 * Get current concept metrics
 */
function getCurrentConceptMetrics(): Record<string, number> {
  // TODO: Replace with feedback/alert queries
  return {
    alert_fp_rate: 0.11,                // ↑ 37.5% (worse)
    aqm_high_suppress_rate: 0.07,       // ↑ 40% (worse)
    fatigue_avg: 0.15,                  // ↑ 25% (worse)
    disagreement_rate: 0.14,            // ↑ 27% (worse)
  };
}

// ============================================================
// DRIFT REPORT BUILDER
// ============================================================

/**
 * Build complete drift report
 * This is the main entry point
 */
export function buildDriftReport(): DriftReport {
  const baseline = getBaseline();
  const baselineData = getBaselineDataMetrics();
  const baselineNetwork = getBaselineNetworkMetrics();
  const baselineConcept = getBaselineConceptMetrics();
  
  const currentData = getCurrentDataMetrics();
  const currentNetwork = getCurrentNetworkMetrics();
  const currentConcept = getCurrentConceptMetrics();
  
  // ============================================================
  // DATA DRIFT
  // ============================================================
  const dataMetrics = DATA_DRIFT_METRICS.map(def => 
    computeMetricDrift(
      def.key,
      def.label,
      baselineData[def.baseline_key as keyof typeof baselineData],
      currentData[def.key],
      def.unit
    )
  );
  const dataSection = buildSection(dataMetrics);
  
  // ============================================================
  // NETWORK DRIFT
  // ============================================================
  const networkMetrics = NETWORK_DRIFT_METRICS.map(def => 
    computeMetricDrift(
      def.key,
      def.label,
      baselineNetwork[def.baseline_key as keyof typeof baselineNetwork],
      currentNetwork[def.key],
      def.unit,
      (def as any).inverted
    )
  );
  const networkSection = buildSection(networkMetrics);
  
  // ============================================================
  // CONCEPT DRIFT
  // ============================================================
  const conceptMetrics = CONCEPT_DRIFT_METRICS.map(def => 
    computeMetricDrift(
      def.key,
      def.label,
      baselineConcept[def.baseline_key as keyof typeof baselineConcept],
      currentConcept[def.key],
      def.unit,
      (def as any).inverted
    )
  );
  const conceptSection = buildSection(conceptMetrics);
  
  // ============================================================
  // OVERALL ASSESSMENT
  // ============================================================
  const overall = computeOverallLevel(dataSection, networkSection, conceptSection);
  const recommendation = computeRecommendation(overall, dataSection, networkSection, conceptSection);
  const alertsBlocked = shouldBlockAlerts(overall, conceptSection);
  
  return {
    snapshot: baseline.id,
    snapshot_date: baseline.created_at,
    window_days: 7,
    overall,
    recommendation,
    data: dataSection,
    network: networkSection,
    concept: conceptSection,
    generated_at: new Date().toISOString(),
    alerts_blocked: alertsBlocked,
  };
}

// ============================================================
// RECOMMENDATION LOGIC
// ============================================================

/**
 * Compute recommendation based on drift levels
 */
function computeRecommendation(
  overall: DriftLevel,
  data: { level: DriftLevel },
  network: { level: DriftLevel },
  concept: { level: DriftLevel }
): DriftRecommendation {
  // FREEZE_REQUIRED: overall HIGH or concept HIGH
  if (overall === 'HIGH' || concept.level === 'HIGH') {
    return 'FREEZE_REQUIRED';
  }
  
  // REVIEW_REQUIRED: overall MEDIUM with HIGH in data/network
  if (overall === 'MEDIUM' && (data.level === 'HIGH' || network.level === 'HIGH')) {
    return 'REVIEW_REQUIRED';
  }
  
  // WARN: any section MEDIUM
  if (data.level === 'MEDIUM' || network.level === 'MEDIUM' || concept.level === 'MEDIUM') {
    return 'WARN';
  }
  
  return 'NONE';
}

/**
 * Determine if alerts/live expansion should be blocked
 */
function shouldBlockAlerts(overall: DriftLevel, concept: { level: DriftLevel }): boolean {
  // Block if overall HIGH or concept HIGH
  return overall === 'HIGH' || concept.level === 'HIGH';
}

// ============================================================
// QUICK STATUS
// ============================================================

/**
 * Get quick drift status (for headers/badges)
 */
export function getDriftStatus(): { 
  level: DriftLevel; 
  recommendation: DriftRecommendation;
  blocked: boolean;
} {
  const report = buildDriftReport();
  return {
    level: report.overall,
    recommendation: report.recommendation,
    blocked: report.alerts_blocked,
  };
}

/**
 * Check if system is stable enough for live expansion
 */
export function canExpandLive(): { allowed: boolean; reason?: string } {
  const status = getDriftStatus();
  
  if (status.blocked) {
    return { 
      allowed: false, 
      reason: `Drift level ${status.level} — ${status.recommendation}` 
    };
  }
  
  if (status.level === 'MEDIUM') {
    return { 
      allowed: true, 
      reason: 'Proceed with caution — MEDIUM drift detected' 
    };
  }
  
  return { allowed: true };
}

console.log('[Drift] Report service loaded');
