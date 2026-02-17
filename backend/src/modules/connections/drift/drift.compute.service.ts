/**
 * Drift v1 Compute Service
 * Phase 6.0 — Environment Observation Layer
 * 
 * PURE COMPUTATION — no side effects, no system changes
 */

import type { DriftLevel, DriftMetricResult, DriftSection } from './drift.types.js';
import { DRIFT_LEVEL_THRESHOLDS } from './drift.constants.js';

// ============================================================
// LEVEL CLASSIFICATION
// ============================================================

/**
 * Classify delta percentage into drift level
 * Uses absolute value — direction doesn't affect level
 */
export function classifyDeltaToLevel(deltaPct: number): DriftLevel {
  const abs = Math.abs(deltaPct);
  
  if (abs < DRIFT_LEVEL_THRESHOLDS.OK) return 'OK';
  if (abs < DRIFT_LEVEL_THRESHOLDS.LOW) return 'LOW';
  if (abs < DRIFT_LEVEL_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Get direction of change
 */
export function getDirection(deltaPct: number): 'UP' | 'DOWN' | 'STABLE' {
  if (deltaPct > 5) return 'UP';
  if (deltaPct < -5) return 'DOWN';
  return 'STABLE';
}

// ============================================================
// METRIC DRIFT COMPUTATION
// ============================================================

/**
 * Compute drift for a single metric
 * Core computation — baseline vs current
 */
export function computeMetricDrift(
  key: string,
  label: string,
  baseline: number,
  current: number,
  unit?: string,
  inverted?: boolean
): DriftMetricResult {
  // Handle zero baseline
  if (baseline === 0) {
    return {
      key,
      label,
      baseline,
      current,
      delta_pct: current !== 0 ? 100 : 0,
      level: current !== 0 ? 'MEDIUM' : 'OK',
      unit,
      direction: current > 0 ? 'UP' : 'STABLE',
    };
  }
  
  // Calculate percentage change
  let delta_pct = ((current - baseline) / baseline) * 100;
  
  // For inverted metrics (where increase is bad), flip the sign for level classification
  const levelDelta = inverted ? -delta_pct : delta_pct;
  
  return {
    key,
    label,
    baseline,
    current,
    delta_pct: Math.round(delta_pct * 10) / 10,
    level: classifyDeltaToLevel(levelDelta),
    unit,
    direction: getDirection(delta_pct),
  };
}

// ============================================================
// SECTION AGGREGATION
// ============================================================

/**
 * Aggregate multiple metrics into section level
 * Rules:
 * - If any HIGH → section HIGH
 * - If ≥2 MEDIUM → section HIGH  
 * - If any MEDIUM → section MEDIUM
 * - If any LOW → section LOW
 * - Otherwise OK
 */
export function aggregateSectionLevel(metrics: DriftMetricResult[]): DriftLevel {
  const levels = metrics.map(m => m.level);
  
  const highCount = levels.filter(l => l === 'HIGH').length;
  const mediumCount = levels.filter(l => l === 'MEDIUM').length;
  const lowCount = levels.filter(l => l === 'LOW').length;
  
  // Any HIGH → HIGH
  if (highCount > 0) return 'HIGH';
  
  // ≥2 MEDIUM → HIGH
  if (mediumCount >= 2) return 'HIGH';
  
  // Any MEDIUM → MEDIUM
  if (mediumCount > 0) return 'MEDIUM';
  
  // Any LOW → LOW
  if (lowCount > 0) return 'LOW';
  
  return 'OK';
}

/**
 * Generate human-readable issues from metrics
 */
export function generateIssues(metrics: DriftMetricResult[]): string[] {
  const issues: string[] = [];
  
  for (const m of metrics) {
    if (m.level === 'HIGH') {
      const dir = m.direction === 'UP' ? '↑' : m.direction === 'DOWN' ? '↓' : '';
      issues.push(`${m.label} ${dir} ${Math.abs(m.delta_pct)}% from baseline (CRITICAL)`);
    } else if (m.level === 'MEDIUM') {
      const dir = m.direction === 'UP' ? '↑' : m.direction === 'DOWN' ? '↓' : '';
      issues.push(`${m.label} ${dir} ${Math.abs(m.delta_pct)}% from baseline`);
    }
  }
  
  return issues;
}

/**
 * Build section from metrics
 */
export function buildSection(metrics: DriftMetricResult[]): DriftSection {
  return {
    level: aggregateSectionLevel(metrics),
    metrics,
    issues: generateIssues(metrics),
  };
}

// ============================================================
// OVERALL LEVEL COMPUTATION
// ============================================================

/**
 * Compute overall drift level from sections
 * Concept drift weighs more (it's the most dangerous)
 */
export function computeOverallLevel(
  data: DriftSection,
  network: DriftSection,
  concept: DriftSection
): DriftLevel {
  // Concept HIGH → overall HIGH (most important)
  if (concept.level === 'HIGH') return 'HIGH';
  
  // Any two sections HIGH → overall HIGH
  const highCount = [data.level, network.level, concept.level]
    .filter(l => l === 'HIGH').length;
  if (highCount >= 2) return 'HIGH';
  
  // Any section HIGH → overall MEDIUM
  if (highCount > 0) return 'MEDIUM';
  
  // Concept MEDIUM → overall MEDIUM
  if (concept.level === 'MEDIUM') return 'MEDIUM';
  
  // ≥2 sections MEDIUM → overall MEDIUM
  const mediumCount = [data.level, network.level, concept.level]
    .filter(l => l === 'MEDIUM').length;
  if (mediumCount >= 2) return 'MEDIUM';
  
  // Any MEDIUM → LOW
  if (mediumCount > 0) return 'LOW';
  
  // Any LOW → LOW
  const lowCount = [data.level, network.level, concept.level]
    .filter(l => l === 'LOW').length;
  if (lowCount > 0) return 'LOW';
  
  return 'OK';
}

console.log('[Drift] Compute service loaded');
