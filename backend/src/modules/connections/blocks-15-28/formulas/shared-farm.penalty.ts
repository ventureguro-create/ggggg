/**
 * BLOCK 15 - Shared Farm Penalty Calculator
 * 
 * Calculates penalty for shared bot farms affecting AQI
 */

export function computeSharedFarmPenalty(params: {
  sharedFarms: Array<{ sharedFollowers: number; confidence: number }>;
}): number {
  // cap: 30
  let p = 0;
  for (const f of params.sharedFarms) {
    p += Math.log(f.sharedFollowers + 1) * (0.5 + 0.5 * f.confidence);
  }
  // normalization
  p = p * 2.2;
  return Math.max(0, Math.min(30, Math.round(p * 10) / 10));
}

/**
 * Farm confidence formula
 * farm_confidence = log(sharedFollowers + 1) × botRatio × actorOverlapFactor
 */
export function computeFarmConfidence(params: {
  sharedFollowers: number;
  botRatio: number;
  avgFollowersA: number;
  avgFollowersB: number;
}): number {
  const avgFollowers = (params.avgFollowersA + params.avgFollowersB) / 2;
  const actorOverlapFactor = avgFollowers > 0 
    ? params.sharedFollowers / avgFollowers 
    : 0;
  
  const confidence = Math.log(params.sharedFollowers + 1) * params.botRatio * actorOverlapFactor;
  return Math.max(0, Math.min(1, confidence));
}
