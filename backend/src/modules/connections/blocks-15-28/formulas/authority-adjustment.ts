/**
 * BLOCK 22 - Authority Adjustment by Authenticity
 * 
 * Uses IAS as a modifier for Authority (never increases, only reduces)
 */

import { authenticityLabel, type AuthenticityLabel } from './authenticity.score.js';

export interface AuthorityAdjustmentResult {
  adjustedAuthority: number;
  multiplier: number;
  label: AuthenticityLabel;
}

/**
 * Authority adjustment based on authenticity
 * 
 * Formula: adjustedAuthority = baseAuthority × authenticityMultiplier
 * 
 * | IAS      | Label        | Multiplier | Effect         |
 * |----------|--------------|------------|----------------|
 * | 80-100   | ORGANIC      | 1.0        | No change      |
 * | 60-79    | MOSTLY_REAL  | 0.9-1.0    | Light trust    |
 * | 40-59    | MIXED        | 0.7-0.9    | Reduction      |
 * | 20-39    | FARMED       | 0.5-0.7    | Strong penalty |
 * | 0-19     | HIGHLY_FARMED| 0.4        | Hard cap       |
 */
export function authenticityAuthorityModifier(
  baseAuthority: number,
  authenticityScore: number
): AuthorityAdjustmentResult {
  // Multiplier: min 0.4, max 1.0
  const multiplier = Math.max(
    0.4,
    Math.min(1.0, authenticityScore / 100)
  );

  return {
    adjustedAuthority: Math.round(baseAuthority * multiplier),
    multiplier,
    label: authenticityLabel(authenticityScore)
  };
}
