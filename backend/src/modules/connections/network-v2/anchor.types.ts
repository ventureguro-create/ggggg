/**
 * Network Anchor Types - Phase 1
 * 
 * Anchors = Sources of real-world authority that exist
 * independently of Twitter graph.
 * 
 * Used by Network v2 to:
 * 1. Bootstrap authority for new accounts
 * 2. Validate network-derived scores
 * 3. Break "chicken-egg" problem
 */

import type { NetworkAnchor, NetworkAnchorType } from '../backers/backer.types.js';

// Re-export for convenience
export type { NetworkAnchor, NetworkAnchorType };

// ============================================================
// ANCHOR SCORE
// ============================================================

export interface AnchorScore {
  twitterId: string;
  
  // Anchor sources
  anchors: NetworkAnchor[];
  
  // Computed values
  anchorWeight: number;     // 0-1, combined anchor weight
  anchorConfidence: number; // 0-1, combined confidence
  
  // Integration with Network v2
  networkBoost: number;     // How much to boost network score
  
  // Timestamps
  computedAt: Date;
}

// ============================================================
// ANCHOR CONTRIBUTION TO NETWORK
// ============================================================

export interface AnchorNetworkContribution {
  // Direct contribution from anchors
  directAuthority: number;
  
  // Path-based contribution (connections to anchors)
  pathAuthority: number;
  
  // Combined
  totalAnchorAuthority: number;
  
  // Cap applied?
  capped: boolean;
  originalTotal?: number;
}

// ============================================================
// ANCHOR-AWARE NETWORK SCORE
// ============================================================

export interface AnchorAwareNetworkScore {
  // Original Network v2 score (graph-based)
  graphScore: number;
  
  // Anchor contribution
  anchorContribution: AnchorNetworkContribution;
  
  // Final blended score
  finalScore: number;
  
  // Weights used
  weights: {
    graph: number;
    anchor: number;
  };
  
  // Interpretation
  interpretation: {
    hasAnchors: boolean;
    anchorStrength: 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';
    recommendation: string;
  };
}

// ============================================================
// ANCHOR DISCOVERY (for finding potential anchors)
// ============================================================

export interface AnchorCandidate {
  twitterId: string;
  handle?: string;
  
  // Why this might be an anchor
  signals: {
    hasBackerBinding: boolean;
    highEliteExposure: boolean;
    knownExchange: boolean;
    knownProject: boolean;
  };
  
  // Suggested anchor type
  suggestedType: NetworkAnchorType;
  
  // Confidence in suggestion
  confidence: number;
}

// ============================================================
// CONSTANTS
// ============================================================

// Max weight anchor can contribute to final score
export const ANCHOR_WEIGHT_CAP = 0.40;

// Minimum anchor weight to consider
export const MIN_ANCHOR_WEIGHT = 0.10;

// Default blend: 70% graph, 30% anchor
export const DEFAULT_ANCHOR_BLEND = {
  graph: 0.70,
  anchor: 0.30,
};

// Anchor strength thresholds
export const ANCHOR_STRENGTH_THRESHOLDS = {
  NONE: 0,
  WEAK: 0.15,
  MODERATE: 0.35,
  STRONG: 0.60,
};

console.log('[NetworkAnchors] Types loaded');
