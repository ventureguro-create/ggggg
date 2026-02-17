/**
 * Graph Scoring - compute edge weights and node scores
 */

import { GraphEdge, GraphNode, RiskLevel, EarlySignalBadge, ProfileType } from '../../contracts/graph.contracts.js';

/**
 * Compute edge weight from overlap metrics
 * 
 * Formula: weighted combination of jaccard and directional overlaps
 */
export function computeEdgeWeight(
  jaccard: number,
  a_to_b: number,
  b_to_a: number
): number {
  // Weights for different components
  const W_JACCARD = 0.4;
  const W_DIRECTIONAL = 0.6;
  
  // Directional score = geometric mean of both directions
  const directional = Math.sqrt(a_to_b * b_to_a);
  
  // Combined weight
  const weight = W_JACCARD * jaccard + W_DIRECTIONAL * directional;
  
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, weight));
}

/**
 * Determine edge strength category
 */
export function getEdgeStrength(weight: number): 'low' | 'medium' | 'high' {
  if (weight >= 0.6) return 'high';
  if (weight >= 0.3) return 'medium';
  return 'low';
}

/**
 * Compute node visual size based on influence
 */
export function computeNodeSize(influence_score: number, maxInfluence: number): number {
  const MIN_SIZE = 8;
  const MAX_SIZE = 40;
  
  if (maxInfluence === 0) return MIN_SIZE;
  
  const normalized = influence_score / maxInfluence;
  return MIN_SIZE + normalized * (MAX_SIZE - MIN_SIZE);
}

/**
 * Compute node color based on profile type and early signal
 */
export function computeNodeColor(
  profile_type: ProfileType,
  early_signal: EarlySignalBadge
): string {
  // Early signals take priority
  if (early_signal === 'breakout') return '#22c55e';  // green
  if (early_signal === 'rising') return '#eab308';    // yellow
  
  // Then profile type
  switch (profile_type) {
    case 'whale': return '#6366f1';      // indigo
    case 'influencer': return '#8b5cf6'; // purple
    default: return '#64748b';           // gray
  }
}

/**
 * Calculate overall graph density
 * Density = actual edges / possible edges
 */
export function calculateGraphDensity(nodeCount: number, edgeCount: number): number {
  if (nodeCount < 2) return 0;
  
  // Maximum possible edges in undirected graph
  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  
  return maxEdges > 0 ? edgeCount / maxEdges : 0;
}

/**
 * Calculate average degree (edges per node)
 */
export function calculateAvgDegree(nodeCount: number, edgeCount: number): number {
  if (nodeCount === 0) return 0;
  
  // Each edge connects 2 nodes
  return (2 * edgeCount) / nodeCount;
}

/**
 * Determine risk level from red flags count
 */
export function computeRiskLevel(redFlagsCount: number): RiskLevel {
  if (redFlagsCount >= 3) return 'high';
  if (redFlagsCount >= 1) return 'medium';
  return 'low';
}

/**
 * Determine profile type from influence score
 */
export function computeProfileType(influenceScore: number, percentile?: number): ProfileType {
  // If we have percentile info
  if (percentile !== undefined) {
    if (percentile >= 90) return 'whale';
    if (percentile >= 70) return 'influencer';
    return 'retail';
  }
  
  // Fallback to absolute thresholds
  if (influenceScore >= 800) return 'whale';
  if (influenceScore >= 500) return 'influencer';
  return 'retail';
}

/**
 * Determine early signal badge from signal score
 */
export function computeEarlySignalBadge(
  signalScore: number,
  breakoutThreshold: number = 700,
  risingThreshold: number = 400
): EarlySignalBadge {
  if (signalScore >= breakoutThreshold) return 'breakout';
  if (signalScore >= risingThreshold) return 'rising';
  return 'none';
}
