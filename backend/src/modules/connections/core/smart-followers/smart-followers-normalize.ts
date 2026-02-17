/**
 * Smart Followers Normalization Helpers
 */

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Logistic normalization: 1 - exp(-k * w)
 * Good for unbounded weights
 */
export function logistic01(totalWeight: number, k: number, clamp: boolean): number {
  const w = Math.max(0, totalWeight);
  const s = 1 - Math.exp(-k * w);
  return clamp ? clamp01(s) : s;
}

/**
 * Linear minmax normalization
 */
export function minmax01(
  totalWeight: number, 
  minW: number, 
  maxW: number, 
  clamp: boolean
): number {
  const span = (maxW - minW) || 1;
  const s = (totalWeight - minW) / span;
  return clamp ? clamp01(s) : s;
}
