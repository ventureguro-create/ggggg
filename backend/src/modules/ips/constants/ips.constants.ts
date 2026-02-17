/**
 * IPS Constants - Time Windows & Thresholds
 * 
 * PHASE G: Informed Action Probability
 */

// Time windows for outcome analysis
export const TIME_WINDOWS = [
  { key: '1h' as const, ms: 60 * 60 * 1000, label: '1 Hour' },
  { key: '4h' as const, ms: 4 * 60 * 60 * 1000, label: '4 Hours' },
  { key: '24h' as const, ms: 24 * 60 * 60 * 1000, label: '24 Hours' }
] as const;

export type WindowKey = '1h' | '4h' | '24h';

// IPS Factor Weights (v1)
export const IPS_WEIGHTS = {
  direction: 0.25,      // Direction match
  time: 0.25,           // Time advantage
  consistency: 0.20,    // Consistency across events
  independence: 0.15,   // Not following crowd
  reality: 0.15         // Reality layer adjustment
} as const;

// Outcome classification thresholds
export const OUTCOME_THRESHOLDS = {
  volatilitySpike: 2.5,     // Standard deviations
  positiveMove: 1.2,        // Percentage
  negativeMove: -1.2        // Percentage
} as const;

// Guard rails - minimum requirements for IPS calculation
export const IPS_GUARD_RAILS = {
  minEvents: 3,
  minConfirmedOutcomes: 1,
  minOnchainConfidence: 0.3,
  minSampleSize: 10
} as const;

// Authority modifier bounds
export const AUTHORITY_MODIFIER = {
  minMultiplier: 0.6,
  maxMultiplier: 1.15,
  baseOffset: 0.6,
  ipsWeight: 0.4
} as const;

// IPS verdict thresholds
export const IPS_VERDICTS = {
  informed: 0.65,     // >= 0.65 → INFORMED
  noise: 0.35         // < 0.35 → NOISE, between = MIXED
} as const;
