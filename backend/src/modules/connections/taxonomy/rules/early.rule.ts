/**
 * EARLY_PROJECTS Group Rule
 * 
 * FORMULA:
 * early_weight =
 *   0.40 * early_signal_score +
 *   0.25 * smart_cluster_support +
 *   0.20 * trend_acceleration +
 *   0.15 * (1 - popularity_mass)
 */

import { clamp01, safeNum } from '../taxonomy.constants.js';

export interface EarlyRuleInput {
  early_signal_score_0_1?: number;
  smart_cluster_support_0_1?: number;
  trend_acceleration_0_1?: number;
  popularity_mass_0_1?: number;
}

export function computeEarlyWeight(m: EarlyRuleInput) {
  const earlySignal = safeNum(m.early_signal_score_0_1);
  const smartSupport = safeNum(m.smart_cluster_support_0_1);
  const accel = safeNum(m.trend_acceleration_0_1);
  const popularityMass = safeNum(m.popularity_mass_0_1);

  const w =
    0.40 * earlySignal +
    0.25 * smartSupport +
    0.20 * accel +
    0.15 * (1 - popularityMass);

  const reasons: string[] = [];
  if (earlySignal >= 0.5) reasons.push('Early signals present');
  if (smartSupport >= 0.5) reasons.push('Supported by smart cluster');
  if (accel >= 0.5) reasons.push('Acceleration detected');
  if (popularityMass <= 0.4) reasons.push('Not mass-popular yet');

  return { 
    weight: clamp01(w), 
    reasons, 
    evidence: { earlySignal, smartSupport, accel, popularityMass } 
  };
}
