/**
 * BLOCK 19 - Farm Overlap Scoring
 * 
 * Calculates overlap between influencers sharing suspicious followers
 */

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function computeClusterConcentration(
  topClusters: { cnt: number }[],
  shared: number
): number {
  if (!shared) return 0;
  const top3 = topClusters.slice(0, 3).reduce((s, c) => s + c.cnt, 0);
  return clamp01(top3 / shared);
}

/**
 * Overlap Score formula
 * overlapScore = 0.55 * sigmoid(sharedSuspects/20) + 0.30 * jaccard + 0.15 * clusterConcentration
 */
export function computeOverlapScore(args: {
  sharedSuspects: number;
  jaccard: number;
  clusterConcentration: number;
}): number {
  const s = sigmoid(args.sharedSuspects / 20);
  return clamp01(0.55 * s + 0.30 * args.jaccard + 0.15 * args.clusterConcentration);
}

/**
 * Jaccard similarity coefficient
 * jaccard = |A ∩ B| / |A ∪ B|
 */
export function computeJaccard(
  sharedCount: number,
  totalA: number,
  totalB: number
): number {
  const union = totalA + totalB - sharedCount;
  return union > 0 ? sharedCount / union : 0;
}
