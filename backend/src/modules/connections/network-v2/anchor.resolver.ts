/**
 * Network Anchor Resolver - Phase 1
 * 
 * Resolves anchors for Twitter accounts from:
 * 1. Backer bindings
 * 2. Manual anchor assignments
 * 3. Known entities (exchanges, foundations)
 * 
 * Key principle: Anchors provide baseline authority
 * that doesn't depend on Twitter graph.
 */

import type { 
  NetworkAnchor, 
  AnchorScore,
  AnchorNetworkContribution,
  AnchorAwareNetworkScore,
  ANCHOR_WEIGHT_CAP,
  DEFAULT_ANCHOR_BLEND,
  ANCHOR_STRENGTH_THRESHOLDS,
} from './anchor.types.js';

import * as BackerInheritanceEngine from '../backers/backer.inheritance.engine.js';

// ============================================================
// MAIN RESOLVER
// ============================================================

export async function resolveAnchorsForTwitter(
  twitterId: string
): Promise<AnchorScore> {
  const anchors: NetworkAnchor[] = [];
  
  // 1. Get anchors from Backer bindings
  const backerAnchors = await BackerInheritanceEngine.getNetworkAnchorsForTwitter(twitterId);
  anchors.push(...backerAnchors);
  
  // 2. TODO: Add manual anchors lookup
  // 3. TODO: Add known entities lookup
  
  // Calculate combined weight and confidence
  const anchorWeight = calculateCombinedWeight(anchors);
  const anchorConfidence = calculateCombinedConfidence(anchors);
  
  // Calculate network boost
  const networkBoost = calculateNetworkBoost(anchors);
  
  return {
    twitterId,
    anchors,
    anchorWeight,
    anchorConfidence,
    networkBoost,
    computedAt: new Date(),
  };
}

// ============================================================
// BATCH RESOLUTION
// ============================================================

export async function resolveAnchorsForBatch(
  twitterIds: string[]
): Promise<Map<string, AnchorScore>> {
  const results = new Map<string, AnchorScore>();
  
  for (const twitterId of twitterIds) {
    const score = await resolveAnchorsForTwitter(twitterId);
    results.set(twitterId, score);
  }
  
  return results;
}

// ============================================================
// ANCHOR CONTRIBUTION TO NETWORK SCORE
// ============================================================

export function computeAnchorContribution(
  anchorScore: AnchorScore
): AnchorNetworkContribution {
  if (anchorScore.anchors.length === 0) {
    return {
      directAuthority: 0,
      pathAuthority: 0,
      totalAnchorAuthority: 0,
      capped: false,
    };
  }
  
  // Direct authority = sum of anchor weights × confidence
  let directAuthority = 0;
  for (const anchor of anchorScore.anchors) {
    directAuthority += anchor.weight * anchor.confidence;
  }
  
  // Normalize to 0-100 scale
  directAuthority = Math.min(directAuthority * 100, 100);
  
  // Path authority = 0 for now (requires graph traversal)
  const pathAuthority = 0;
  
  // Total with cap
  const ANCHOR_WEIGHT_CAP = 0.40; // Max 40% of final score from anchors
  let totalAnchorAuthority = directAuthority + pathAuthority;
  const maxAllowed = 100 * ANCHOR_WEIGHT_CAP;
  
  const capped = totalAnchorAuthority > maxAllowed;
  if (capped) {
    totalAnchorAuthority = maxAllowed;
  }
  
  return {
    directAuthority: Math.round(directAuthority * 100) / 100,
    pathAuthority: Math.round(pathAuthority * 100) / 100,
    totalAnchorAuthority: Math.round(totalAnchorAuthority * 100) / 100,
    capped,
    originalTotal: capped ? directAuthority + pathAuthority : undefined,
  };
}

// ============================================================
// BLEND WITH NETWORK SCORE
// ============================================================

export function blendWithNetworkScore(
  graphScore: number,  // 0-100, from Network v2 graph analysis
  anchorScore: AnchorScore
): AnchorAwareNetworkScore {
  const anchorContribution = computeAnchorContribution(anchorScore);
  
  // Default blend: 70% graph, 30% anchor
  const weights = { graph: 0.70, anchor: 0.30 };
  
  // If no anchors, 100% graph
  if (anchorScore.anchors.length === 0) {
    weights.graph = 1.0;
    weights.anchor = 0.0;
  }
  
  // Calculate final score
  const finalScore = 
    (graphScore * weights.graph) + 
    (anchorContribution.totalAnchorAuthority * weights.anchor);
  
  // Interpretation
  const interpretation = interpretAnchorStrength(anchorScore, anchorContribution);
  
  return {
    graphScore,
    anchorContribution,
    finalScore: Math.round(finalScore * 100) / 100,
    weights,
    interpretation,
  };
}

// ============================================================
// HELPERS
// ============================================================

function calculateCombinedWeight(anchors: NetworkAnchor[]): number {
  if (anchors.length === 0) return 0;
  
  // Take max weight (not sum, to avoid inflation)
  let maxWeight = 0;
  for (const anchor of anchors) {
    maxWeight = Math.max(maxWeight, anchor.weight);
  }
  
  return maxWeight;
}

function calculateCombinedConfidence(anchors: NetworkAnchor[]): number {
  if (anchors.length === 0) return 0;
  
  // Average confidence
  const sum = anchors.reduce((acc, a) => acc + a.confidence, 0);
  return sum / anchors.length;
}

function calculateNetworkBoost(anchors: NetworkAnchor[]): number {
  if (anchors.length === 0) return 0;
  
  // Boost = weighted average of anchor weights
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const anchor of anchors) {
    weightedSum += anchor.weight * anchor.confidence;
    totalWeight += anchor.confidence;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function interpretAnchorStrength(
  anchorScore: AnchorScore,
  contribution: AnchorNetworkContribution
): AnchorAwareNetworkScore['interpretation'] {
  const hasAnchors = anchorScore.anchors.length > 0;
  
  // Determine strength
  let anchorStrength: 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG' = 'NONE';
  const weight = anchorScore.anchorWeight;
  
  const THRESHOLDS = {
    NONE: 0,
    WEAK: 0.15,
    MODERATE: 0.35,
    STRONG: 0.60,
  };
  
  if (weight >= THRESHOLDS.STRONG) {
    anchorStrength = 'STRONG';
  } else if (weight >= THRESHOLDS.MODERATE) {
    anchorStrength = 'MODERATE';
  } else if (weight >= THRESHOLDS.WEAK) {
    anchorStrength = 'WEAK';
  }
  
  // Generate recommendation
  let recommendation = '';
  if (!hasAnchors) {
    recommendation = 'No real-world anchors found. Authority based solely on network graph.';
  } else if (anchorStrength === 'STRONG') {
    recommendation = 'Strong real-world backing. High confidence in authority.';
  } else if (anchorStrength === 'MODERATE') {
    recommendation = 'Moderate real-world backing. Authority reasonably validated.';
  } else {
    recommendation = 'Weak real-world backing. Rely more on network signals.';
  }
  
  return {
    hasAnchors,
    anchorStrength,
    recommendation,
  };
}

// ============================================================
// CHECK IF ACCOUNT IS ANCHOR
// ============================================================

export async function isAnchorAccount(twitterId: string): Promise<boolean> {
  const score = await resolveAnchorsForTwitter(twitterId);
  return score.anchors.length > 0;
}

// ============================================================
// GET TOP ANCHORED ACCOUNTS
// ============================================================

export async function getTopAnchoredAccounts(
  twitterIds: string[],
  limit: number = 20
): Promise<AnchorScore[]> {
  const scores = await resolveAnchorsForBatch(twitterIds);
  
  // Sort by anchor weight descending
  const sorted = Array.from(scores.values())
    .filter(s => s.anchors.length > 0)
    .sort((a, b) => b.anchorWeight - a.anchorWeight)
    .slice(0, limit);
  
  return sorted;
}

console.log('[NetworkAnchorResolver] Initialized');
