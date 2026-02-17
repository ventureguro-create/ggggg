/**
 * Twitter Confidence Score Computation
 * 
 * Core formula:
 * TCS = freshness×0.25 + consistency×0.25 + coverage×0.20 + anomaly_health×0.20 + source_trust×0.10
 * 
 * PHASE 4.1.6 — Twitter Confidence Score v1.0
 */

import type { 
  TwitterConfidenceInput, 
  TwitterConfidenceResult,
  TwitterConfidenceComponents,
  DampeningResult,
} from '../contracts/index.js';
import { getConfidenceConfig } from './twitter-confidence.config.js';
import { getConfidenceLabel, shouldDampen } from './twitter-confidence.label.js';

/**
 * Compute freshness component
 * 
 * freshness = exp(-age_hours / half_life)
 */
export function computeFreshness(ageHours: number): number {
  const { freshness: freshnessConfig } = getConfidenceConfig();
  const halfLife = freshnessConfig.half_life_hours;
  
  // Exponential decay
  const freshness = Math.exp(-ageHours / halfLife);
  return Math.max(0, Math.min(1, freshness));
}

/**
 * Compute coverage component
 * 
 * Based on which data sources are available
 */
export function computeCoverage(input: TwitterConfidenceInput): number {
  const { coverage: coverageConfig } = getConfidenceConfig();
  
  let score = 0;
  if (input.has_follow_graph) score += coverageConfig.follow_graph;
  if (input.has_engagement) score += coverageConfig.engagement;
  if (input.has_profile_meta) score += coverageConfig.profile_meta;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Compute consistency component
 * 
 * Based on data quality indicators
 */
export function computeConsistency(input: TwitterConfidenceInput): number {
  let penalty = 0;
  
  // Time series gaps penalty
  if (input.time_series_gaps && input.time_series_gaps > 0) {
    // Each gap reduces consistency by 0.05, max 0.4 penalty
    penalty += Math.min(0.4, input.time_series_gaps * 0.05);
  }
  
  // Volatility penalty
  if (input.volatility_score && input.volatility_score > 0.3) {
    // High volatility = less consistent
    penalty += (input.volatility_score - 0.3) * 0.5;
  }
  
  return Math.max(0, 1 - penalty);
}

/**
 * Compute anomaly health component
 * 
 * Based on guard flags
 */
export function computeAnomalyHealth(input: TwitterConfidenceInput): number {
  const { anomaly_penalties } = getConfidenceConfig();
  const flags = input.anomaly_flags || {};
  
  let penalty = 0;
  
  if (flags.spike_detected) {
    penalty += anomaly_penalties.spike;
  }
  
  if (flags.duplicates_rate && flags.duplicates_rate > 0.1) {
    penalty += anomaly_penalties.duplicates * flags.duplicates_rate;
  }
  
  if (flags.suspicious_ratios) {
    penalty += anomaly_penalties.suspicious_ratios;
  }
  
  if (flags.rate_limited) {
    penalty += anomaly_penalties.rate_limit;
  }
  
  return Math.max(0, 1 - penalty);
}

/**
 * Compute source trust component
 */
export function computeSourceTrust(sourceType?: string): number {
  const trustMap: Record<string, number> = {
    'parser_storage': 1.0,
    'api_fallback': 0.8,
    'user_triggered': 0.6,
    'mock': 0.95,  // Mock is stable/trusted for testing
    'unknown': 0.5,
  };
  
  return trustMap[sourceType || 'unknown'] || 0.5;
}

/**
 * Main confidence computation function
 */
export function computeTwitterConfidence(input: TwitterConfidenceInput): TwitterConfidenceResult {
  const config = getConfidenceConfig();
  const warnings: string[] = [];
  
  // Compute each component
  const freshness = computeFreshness(input.data_age_hours);
  const coverage = computeCoverage(input);
  const consistency = computeConsistency(input);
  const anomaly_health = computeAnomalyHealth(input);
  const source_trust = computeSourceTrust(input.source_type);
  
  const components: TwitterConfidenceComponents = {
    freshness,
    consistency,
    coverage,
    anomaly_health,
    source_trust,
  };
  
  // Weighted sum
  const score_0_1 = Math.max(0, Math.min(1,
    freshness * config.weights.freshness +
    consistency * config.weights.consistency +
    coverage * config.weights.coverage +
    anomaly_health * config.weights.anomaly_health +
    source_trust * config.weights.source_trust
  ));
  
  // Get label
  const label = getConfidenceLabel(score_0_1);
  
  // Generate warnings
  if (freshness < 0.5) {
    warnings.push(`Data is ${input.data_age_hours.toFixed(1)}h old (freshness: ${(freshness * 100).toFixed(0)}%)`);
  }
  
  if (!input.has_follow_graph) {
    warnings.push('Missing follow graph data');
  }
  
  if (!input.has_engagement) {
    warnings.push('Missing engagement data');
  }
  
  if (input.anomaly_flags?.spike_detected) {
    warnings.push('Engagement spike detected and dampened');
  }
  
  if (input.anomaly_flags?.suspicious_ratios) {
    warnings.push('Suspicious follower/following ratio detected');
  }
  
  if (anomaly_health < 0.7) {
    warnings.push('Multiple anomaly flags affecting confidence');
  }
  
  return {
    score_0_1: Math.round(score_0_1 * 1000) / 1000,
    label,
    components: {
      freshness: Math.round(freshness * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      coverage: Math.round(coverage * 100) / 100,
      anomaly_health: Math.round(anomaly_health * 100) / 100,
      source_trust: Math.round(source_trust * 100) / 100,
    },
    warnings,
    meta: {
      computed_at: new Date().toISOString(),
      input_age_hours: input.data_age_hours,
      source: (input.source_type as any) || 'unknown',
    },
  };
}

/**
 * Compute dampening multiplier based on confidence
 */
export function computeDampening(confidence: TwitterConfidenceResult): DampeningResult {
  const config = getConfidenceConfig();
  
  if (!config.dampening.enabled) {
    return { should_dampen: false, multiplier: 1.0 };
  }
  
  const shouldApply = shouldDampen(confidence.label);
  
  if (!shouldApply) {
    return { should_dampen: false, multiplier: 1.0 };
  }
  
  // Linear interpolation: score -> multiplier
  // At score = 1.0, multiplier = 1.0
  // At score = 0.0, multiplier = min_multiplier
  const multiplier = config.dampening.min_multiplier + 
    (1 - config.dampening.min_multiplier) * confidence.score_0_1;
  
  return {
    should_dampen: true,
    multiplier: Math.round(multiplier * 100) / 100,
    reason: `Confidence ${confidence.label} (${(confidence.score_0_1 * 100).toFixed(0)}%) → multiplier ${(multiplier * 100).toFixed(0)}%`,
  };
}

/**
 * Check if alerts should be blocked based on confidence
 */
export function shouldBlockAlerts(confidence: TwitterConfidenceResult): { block: boolean; reason?: string } {
  const config = getConfidenceConfig();
  
  if (confidence.score_0_1 < config.policy.block_alerts_below) {
    return {
      block: true,
      reason: `Confidence ${(confidence.score_0_1 * 100).toFixed(0)}% < threshold ${(config.policy.block_alerts_below * 100).toFixed(0)}%`,
    };
  }
  
  return { block: false };
}

/**
 * Check if alerts should include warning
 */
export function shouldWarnInAlerts(confidence: TwitterConfidenceResult): boolean {
  const config = getConfidenceConfig();
  return confidence.score_0_1 < config.policy.warn_in_alerts_below;
}
