/**
 * Decay utilities for recency weighting
 * Phase 3 Step 4: Credibility Engine
 */

/**
 * Exponential decay weight
 * weight = 0.5^(age/halfLife)
 */
export function expDecayWeight(ageDays: number, halfLifeDays: number): number {
  return Math.pow(0.5, ageDays / Math.max(1, halfLifeDays));
}
