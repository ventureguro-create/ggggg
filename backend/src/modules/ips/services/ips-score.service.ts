/**
 * IPS Core Score Service
 * 
 * PHASE G4: Calculate Informed Probability Score
 * 
 * IPS = probability that actions are NOT random
 * NOT a signal, NOT a prediction
 */

import { IPSFactors, IPSVerdict, MarketSnapshot, Outcome, IPSReality } from '../models/ips.types';
import { IPS_WEIGHTS, IPS_VERDICTS, IPS_GUARD_RAILS } from '../constants/ips.constants';
import { calculateDirectionScore } from './outcome-classification.service';

/**
 * Clamp value to [0, 1]
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Calculate time advantage score
 * Higher = event occurred before market moved
 */
function calculateTimeAdvantage(
  eventTimestamp: number,
  snapshot: MarketSnapshot,
  windowMs: number
): number {
  // If price moved significantly, earlier events get higher score
  const moveSize = Math.abs(snapshot.priceDelta);
  
  if (moveSize < 0.5) return 0.5; // No significant move
  
  // The larger the move, the higher the time advantage
  // (being early on a big move is more valuable)
  return clamp01(0.5 + moveSize / 10);
}

/**
 * Calculate consistency score
 * Based on historical pattern of this actor
 */
function calculateConsistency(
  historicalEvents: number,
  historicalAccuracy: number
): number {
  if (historicalEvents < IPS_GUARD_RAILS.minEvents) {
    return 0.5; // Neutral if insufficient history
  }
  
  return clamp01(historicalAccuracy);
}

/**
 * Calculate crowd independence score
 * Higher = not following the crowd
 */
function calculateIndependence(
  eventTimestamp: number,
  crowdActivityBefore: number,
  crowdActivityAfter: number
): number {
  // If crowd activity was low before event but high after = leader
  // If crowd activity was high before = follower
  
  if (crowdActivityBefore > crowdActivityAfter) {
    return 0.3; // Following the crowd
  }
  
  if (crowdActivityAfter > crowdActivityBefore * 2) {
    return 0.9; // Leading the crowd
  }
  
  return 0.6; // Neutral
}

/**
 * Calculate reality adjustment
 * Uses Reality Layer data if available
 */
function calculateRealityAdjustment(reality?: IPSReality): number {
  if (!reality || !reality.verdict) return 0.5;
  
  switch (reality.verdict) {
    case 'CONFIRMS':
      return 0.8 + (reality.realityScore || 0) * 0.2;
    case 'CONTRADICTS':
      return 0.2;
    case 'NO_DATA':
    default:
      return 0.5;
  }
}

/**
 * Calculate all IPS factors
 */
export function calculateFactors(
  eventType: string,
  outcome: Outcome,
  snapshot: MarketSnapshot,
  eventTimestamp: number,
  windowMs: number,
  reality?: IPSReality,
  historical?: { events: number; accuracy: number },
  crowd?: { before: number; after: number }
): IPSFactors {
  const direction = calculateDirectionScore(eventType, outcome, snapshot.priceDelta);
  const time = calculateTimeAdvantage(eventTimestamp, snapshot, windowMs);
  const consistency = calculateConsistency(
    historical?.events || 0,
    historical?.accuracy || 0.5
  );
  const independence = calculateIndependence(
    eventTimestamp,
    crowd?.before || 0,
    crowd?.after || 0
  );
  const realityScore = calculateRealityAdjustment(reality);
  
  return {
    direction: Math.round(direction * 1000) / 1000,
    time: Math.round(time * 1000) / 1000,
    consistency: Math.round(consistency * 1000) / 1000,
    independence: Math.round(independence * 1000) / 1000,
    reality: Math.round(realityScore * 1000) / 1000
  };
}

/**
 * Compute final IPS score from factors
 */
export function computeIPS(factors: IPSFactors): number {
  const raw = 
    IPS_WEIGHTS.direction * factors.direction +
    IPS_WEIGHTS.time * factors.time +
    IPS_WEIGHTS.consistency * factors.consistency +
    IPS_WEIGHTS.independence * factors.independence +
    IPS_WEIGHTS.reality * factors.reality;
  
  return Math.round(clamp01(raw) * 1000) / 1000;
}

/**
 * Determine verdict from IPS score
 */
export function getVerdict(ips: number, eventCount: number): IPSVerdict {
  if (eventCount < IPS_GUARD_RAILS.minEvents) {
    return 'INSUFFICIENT_DATA';
  }
  
  if (ips >= IPS_VERDICTS.informed) {
    return 'INFORMED';
  }
  
  if (ips < IPS_VERDICTS.noise) {
    return 'NOISE';
  }
  
  return 'MIXED';
}

/**
 * Calculate authority modifier from IPS
 * Returns multiplier in [0.6, 1.15]
 */
export function calculateAuthorityModifier(avgIPS: number): number {
  const { minMultiplier, maxMultiplier, baseOffset, ipsWeight } = {
    minMultiplier: 0.6,
    maxMultiplier: 1.15,
    baseOffset: 0.6,
    ipsWeight: 0.4
  };
  
  const raw = baseOffset + avgIPS * ipsWeight;
  return Math.round(clamp01(raw / maxMultiplier) * maxMultiplier * 100) / 100;
}

/**
 * Full IPS calculation
 */
export interface IPSCalculationResult {
  ips: number;
  verdict: IPSVerdict;
  factors: IPSFactors;
  authorityModifier: number;
}

export function calculateFullIPS(
  eventType: string,
  outcome: Outcome,
  snapshot: MarketSnapshot,
  eventTimestamp: number,
  windowMs: number,
  eventCount: number,
  reality?: IPSReality,
  historical?: { events: number; accuracy: number },
  crowd?: { before: number; after: number }
): IPSCalculationResult {
  const factors = calculateFactors(
    eventType,
    outcome,
    snapshot,
    eventTimestamp,
    windowMs,
    reality,
    historical,
    crowd
  );
  
  const ips = computeIPS(factors);
  const verdict = getVerdict(ips, eventCount);
  const authorityModifier = calculateAuthorityModifier(ips);
  
  return { ips, verdict, factors, authorityModifier };
}
