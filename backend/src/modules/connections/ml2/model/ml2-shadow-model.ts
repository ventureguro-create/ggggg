/**
 * ML2 Shadow Model v1
 * Phase 5.3 — ML2 Shadow Enable
 * 
 * DETERMINISTIC baseline model (no actual ML yet)
 * Uses weighted scoring similar to AQM
 * Will be replaced by trained model in v1.1
 */

import type { Ml2Features, Ml2PredictionResult, Ml2Label, Ml2Recommendation } from '../contracts/ml2.types.js';

/**
 * Model weights (can be tuned via config later)
 */
const WEIGHTS = {
  early: 0.30,        // Early signal strength
  conf: 0.25,         // Data confidence
  smart: 0.20,        // Smart followers
  auth: 0.15,         // Network authority
  fatigue: -0.10,     // Alert fatigue penalty
  risk: -0.20,        // Pattern risk penalty
  drift: -0.25,       // Drift penalty (per level)
} as const;

/**
 * Drift level to numeric penalty
 */
function getDriftPenalty(level: string): number {
  switch (level) {
    case 'HIGH': return 1.0;
    case 'MEDIUM': return 0.6;
    case 'LOW': return 0.25;
    default: return 0;
  }
}

/**
 * Score to label mapping
 */
function scoreToLabel(score: number): Ml2Label {
  if (score >= 0.75) return 'HIGH';
  if (score >= 0.55) return 'MEDIUM';
  if (score >= 0.40) return 'LOW';
  return 'NOISE';
}

/**
 * Label to recommendation
 */
function labelToRecommendation(label: Ml2Label): Ml2Recommendation {
  if (label === 'HIGH' || label === 'MEDIUM') return 'KEEP';
  if (label === 'LOW') return 'DOWNRANK';
  return 'SUPPRESS_SUGGEST';
}

/**
 * ML2 Shadow Model v1 — deterministic scoring
 * 
 * Input: Ml2Features
 * Output: Ml2PredictionResult with score, label, recommendation, and explanation
 */
export function ml2ShadowModelV1(features: Ml2Features): Ml2PredictionResult {
  // Calculate drift penalty
  const driftPenalty = getDriftPenalty(features.drift_level);
  
  // Calculate raw score
  const raw =
    features.early_signal_0_1 * WEIGHTS.early +
    features.confidence_0_1 * WEIGHTS.conf +
    features.smart_followers_0_1 * WEIGHTS.smart +
    features.authority_0_1 * WEIGHTS.auth +
    features.fatigue_0_1 * WEIGHTS.fatigue +
    features.pattern_risk_0_1 * WEIGHTS.risk +
    driftPenalty * WEIGHTS.drift;
  
  // Normalize to 0-1
  const score = Math.max(0, Math.min(1, raw + 0.5));  // +0.5 to center around 0.5
  
  const label = scoreToLabel(score);
  const recommendation = labelToRecommendation(label);
  
  // Build explanation
  const allFactors = [
    { key: 'early_signal_0_1', impact: features.early_signal_0_1 * WEIGHTS.early, note: 'Early signal strength', positive: true },
    { key: 'confidence_0_1', impact: features.confidence_0_1 * WEIGHTS.conf, note: 'Data confidence', positive: true },
    { key: 'smart_followers_0_1', impact: features.smart_followers_0_1 * WEIGHTS.smart, note: 'Smart audience quality', positive: true },
    { key: 'authority_0_1', impact: features.authority_0_1 * WEIGHTS.auth, note: 'Network authority', positive: true },
    { key: 'fatigue_0_1', impact: features.fatigue_0_1 * WEIGHTS.fatigue, note: 'Alert fatigue penalty', positive: false },
    { key: 'pattern_risk_0_1', impact: features.pattern_risk_0_1 * WEIGHTS.risk, note: 'Bot/manipulation risk', positive: false },
    { key: 'drift_level', impact: driftPenalty * WEIGHTS.drift, note: `Environment drift (${features.drift_level})`, positive: false },
  ];
  
  const positives = allFactors
    .filter(f => f.positive && f.impact > 0.01)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(({ key, impact, note }) => ({ key, impact: Math.round(impact * 100) / 100, note }));
  
  const negatives = allFactors
    .filter(f => !f.positive && Math.abs(f.impact) > 0.01)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 3)
    .map(({ key, impact, note }) => ({ key, impact: Math.round(impact * 100) / 100, note }));
  
  const summary = 
    label === 'HIGH' ? 'Strong signal with reliable data — recommend sending.' :
    label === 'MEDIUM' ? 'Decent signal worth watching — proceed with caution.' :
    label === 'LOW' ? 'Weak signal — consider deprioritizing.' :
    'Likely noise — recommend suppressing unless policy forces send.';
  
  return {
    version: 'ml2-shadow-v1',
    prob_useful: Math.round(score * 1000) / 1000,
    label,
    recommendation,
    explain: {
      positives,
      negatives,
      summary,
    },
  };
}

console.log('[ML2] Shadow model v1 loaded');
