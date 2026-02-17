/**
 * Outcome Classification Service
 * 
 * PHASE G3: Translate market data → categorical outcome
 * No interpretation, just statistical labels
 */

import { Outcome, MarketSnapshot } from '../models/ips.types';
import { OUTCOME_THRESHOLDS } from '../constants/ips.constants';

/**
 * Classify outcome based on market snapshot
 */
export function classifyOutcome(snapshot: MarketSnapshot): Outcome {
  const { priceDelta, volatility } = snapshot;
  
  // High volatility = special case
  if (volatility > OUTCOME_THRESHOLDS.volatilitySpike) {
    return 'VOLATILITY_SPIKE';
  }
  
  // Positive move
  if (priceDelta > OUTCOME_THRESHOLDS.positiveMove) {
    return 'POSITIVE_MOVE';
  }
  
  // Negative move
  if (priceDelta < OUTCOME_THRESHOLDS.negativeMove) {
    return 'NEGATIVE_MOVE';
  }
  
  // No significant effect
  return 'NO_EFFECT';
}

/**
 * Get outcome label for display
 */
export function getOutcomeLabel(outcome: Outcome): string {
  const labels: Record<Outcome, string> = {
    NO_EFFECT: 'No Effect',
    POSITIVE_MOVE: 'Positive Move',
    NEGATIVE_MOVE: 'Negative Move',
    VOLATILITY_SPIKE: 'Volatility Spike'
  };
  return labels[outcome] || outcome;
}

/**
 * Get outcome color for UI
 */
export function getOutcomeColor(outcome: Outcome): string {
  const colors: Record<Outcome, string> = {
    NO_EFFECT: '#6b7280',      // Gray
    POSITIVE_MOVE: '#22c55e',  // Green
    NEGATIVE_MOVE: '#ef4444',  // Red
    VOLATILITY_SPIKE: '#f59e0b' // Orange
  };
  return colors[outcome] || '#6b7280';
}

/**
 * Check if outcome is "actionable" (not just noise)
 */
export function isActionableOutcome(outcome: Outcome): boolean {
  return outcome !== 'NO_EFFECT';
}

/**
 * Calculate direction score (for IPS factor)
 * Returns: 1 if tweet preceded move in expected direction, 0 otherwise
 */
export function calculateDirectionScore(
  eventType: string,
  outcome: Outcome,
  priceDelta: number
): number {
  // For now: simple binary
  // Positive move after any mention = partial score
  // Could be enhanced with sentiment later
  
  if (outcome === 'NO_EFFECT') return 0.5; // Neutral
  if (outcome === 'POSITIVE_MOVE') return 0.8;
  if (outcome === 'NEGATIVE_MOVE') return 0.3;
  if (outcome === 'VOLATILITY_SPIKE') return 0.6;
  
  return 0.5;
}
