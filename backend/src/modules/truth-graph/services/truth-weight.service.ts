/**
 * Truth Weight Calculator
 * 
 * PHASE H2: Calculate edge weights based on IPS, time, and outcome
 */

import { TruthWeight } from '../models/truth-graph.types';

/**
 * Calculate truth weight for an edge
 * 
 * truth_weight = ips_score * time_proximity * outcome_strength
 */
export function calculateTruthWeight(
  ipsScore: number,
  timeProximityMs: number,
  outcomeStrength: number,
  windowMs: number
): TruthWeight {
  // Normalize IPS (already 0-1)
  const ips = Math.max(0, Math.min(1, ipsScore));
  
  // Time proximity: closer to event = higher score
  // If timeProximityMs is within window, score is high
  const maxTime = windowMs;
  const timeProximity = Math.max(0, 1 - (timeProximityMs / maxTime));
  
  // Outcome strength: magnitude of price/volume move
  // Normalize to 0-1 (assuming outcomeStrength is percentage)
  const normalizedOutcome = Math.min(1, Math.abs(outcomeStrength) / 10);
  
  // Combined raw score
  const raw = ips * timeProximity * normalizedOutcome;
  
  // Normalize to 0-1 with softer curve
  const normalized = Math.round(Math.pow(raw, 0.7) * 1000) / 1000;
  
  return {
    raw: Math.round(raw * 1000) / 1000,
    normalized,
    factors: {
      ips: Math.round(ips * 1000) / 1000,
      timeProximity: Math.round(timeProximity * 1000) / 1000,
      outcomeStrength: Math.round(normalizedOutcome * 1000) / 1000
    }
  };
}

/**
 * Calculate correlation strength between two actors
 */
export function calculateActorCorrelation(
  sharedAssetCount: number,
  totalAssets1: number,
  totalAssets2: number,
  timeAlignmentScore: number,
  ipsAlignment: number
): number {
  // Jaccard-like overlap for assets
  const assetOverlap = sharedAssetCount / Math.max(1, totalAssets1 + totalAssets2 - sharedAssetCount);
  
  // Combined score
  const raw = 0.4 * assetOverlap + 0.3 * timeAlignmentScore + 0.3 * ipsAlignment;
  
  return Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 1000;
}

/**
 * Calculate time alignment between two event series
 */
export function calculateTimeAlignment(
  timestamps1: number[],
  timestamps2: number[],
  windowMs: number = 4 * 60 * 60 * 1000 // 4h default
): number {
  if (timestamps1.length === 0 || timestamps2.length === 0) return 0;
  
  let alignedCount = 0;
  
  for (const t1 of timestamps1) {
    for (const t2 of timestamps2) {
      if (Math.abs(t1 - t2) <= windowMs) {
        alignedCount++;
        break; // Count each t1 only once
      }
    }
  }
  
  return alignedCount / timestamps1.length;
}

/**
 * Determine edge type based on temporal relationship
 */
export function determineTemporalEdgeType(
  timestamp1: number,
  timestamp2: number,
  windowMs: number
): 'PRECEDES' | 'CORRELATED_WITH' | null {
  const diff = timestamp2 - timestamp1;
  
  if (diff > 0 && diff <= windowMs) {
    return 'PRECEDES'; // 1 precedes 2
  }
  
  if (Math.abs(diff) <= windowMs / 2) {
    return 'CORRELATED_WITH'; // Roughly simultaneous
  }
  
  return null; // Too far apart
}
