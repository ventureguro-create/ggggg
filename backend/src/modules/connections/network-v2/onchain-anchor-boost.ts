/**
 * On-chain Anchor Boost - PHASE A2
 * 
 * CRITICAL RULE: On-chain НИКОГДА не даёт сигнал
 * On-chain только подтверждает или опровергает реальность
 * 
 * Verdict → Multiplier:
 * - CONFIRMS     → 1.15 (boost)
 * - NO_DATA      → 1.0  (neutral)
 * - CONTRADICTS  → 0.6  (penalty)
 */

export type OnchainVerdict = 'CONFIRMS' | 'NO_DATA' | 'CONTRADICTS';

export interface OnchainAnchorBoostConfig {
  confirmsMultiplier: number;     // 1.15 - reality confirmed
  noDataMultiplier: number;       // 1.0 - no on-chain data
  contradictsMultiplier: number;  // 0.6 - actions don't match
}

export const DEFAULT_ANCHOR_BOOST_CONFIG: OnchainAnchorBoostConfig = {
  confirmsMultiplier: 1.15,
  noDataMultiplier: 1.0,
  contradictsMultiplier: 0.6,
};

/**
 * Get multiplier based on on-chain verdict
 */
export function getOnchainAnchorMultiplier(
  verdict: OnchainVerdict,
  config: OnchainAnchorBoostConfig = DEFAULT_ANCHOR_BOOST_CONFIG
): number {
  switch (verdict) {
    case 'CONFIRMS':
      return config.confirmsMultiplier;
    case 'CONTRADICTS':
      return config.contradictsMultiplier;
    case 'NO_DATA':
    default:
      return config.noDataMultiplier;
  }
}

/**
 * Derive verdict from on-chain snapshot metrics
 * 
 * Uses:
 * - flow_score (0-1): positive = inflow, negative = outflow
 * - exchange_pressure (-1 to 1): negative = accumulation, positive = distribution
 * - whale_activity (0-1): smart money participation
 */
export interface OnchainMetrics {
  flowScore: number;          // 0-1
  exchangePressure: number;   // -1 to 1
  whaleActivity: number;      // 0-1
  confidence: number;         // 0-1
}

export function deriveOnchainVerdict(
  metrics: OnchainMetrics,
  expectedBehavior: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
): OnchainVerdict {
  // Not enough confidence → no data
  if (metrics.confidence < 0.3) {
    return 'NO_DATA';
  }
  
  // Calculate alignment score
  // Bullish expectation: high flow, low exchange pressure, high whale activity
  // Bearish expectation: low flow, high exchange pressure
  
  let alignmentScore = 0;
  
  if (expectedBehavior === 'BULLISH') {
    // Accumulation pattern
    alignmentScore += metrics.flowScore > 0.6 ? 1 : (metrics.flowScore < 0.4 ? -1 : 0);
    alignmentScore += metrics.exchangePressure < 0 ? 1 : (metrics.exchangePressure > 0.3 ? -1 : 0);
    alignmentScore += metrics.whaleActivity > 0.5 ? 1 : 0;
  } else if (expectedBehavior === 'BEARISH') {
    // Distribution pattern
    alignmentScore += metrics.flowScore < 0.4 ? 1 : (metrics.flowScore > 0.6 ? -1 : 0);
    alignmentScore += metrics.exchangePressure > 0.3 ? 1 : (metrics.exchangePressure < -0.3 ? -1 : 0);
  } else {
    // Neutral: just check for consistency
    return 'NO_DATA';
  }
  
  // Convert to verdict
  if (alignmentScore >= 2) return 'CONFIRMS';
  if (alignmentScore <= -2) return 'CONTRADICTS';
  return 'NO_DATA';
}

/**
 * Apply on-chain anchor boost to any weight/score
 */
export function applyOnchainBoost(
  baseWeight: number,
  verdict: OnchainVerdict,
  config: OnchainAnchorBoostConfig = DEFAULT_ANCHOR_BOOST_CONFIG
): { weight: number; multiplier: number; verdict: OnchainVerdict } {
  const multiplier = getOnchainAnchorMultiplier(verdict, config);
  return {
    weight: Math.round(baseWeight * multiplier * 1000) / 1000,
    multiplier,
    verdict,
  };
}

/**
 * Batch apply on-chain boost to edges
 */
export function applyOnchainBoostToEdges<T extends { weight: number }>(
  edges: T[],
  verdictByNode: Map<string, OnchainVerdict>,
  getNodeId: (edge: T) => string,
  config: OnchainAnchorBoostConfig = DEFAULT_ANCHOR_BOOST_CONFIG
): (T & { onchainBoost: { multiplier: number; verdict: OnchainVerdict } })[] {
  return edges.map(edge => {
    const nodeId = getNodeId(edge);
    const verdict = verdictByNode.get(nodeId) ?? 'NO_DATA';
    const multiplier = getOnchainAnchorMultiplier(verdict, config);
    
    return {
      ...edge,
      weight: Math.round(edge.weight * multiplier * 1000) / 1000,
      onchainBoost: { multiplier, verdict },
    };
  });
}
