/**
 * Weighted Statistics Functions
 * 
 * For time-decayed aggregations.
 */

/**
 * Weighted mean
 * 
 * sum(value * weight) / sum(weight)
 */
export function weightedMean(values: number[], weights: number[]): number {
  if (values.length === 0 || values.length !== weights.length) return 0;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < values.length; i++) {
    numerator += values[i] * weights[i];
    denominator += weights[i];
  }
  
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Weighted standard deviation
 * 
 * sqrt(sum(weight * (value - mean)^2) / sum(weight))
 */
export function weightedStd(values: number[], weights: number[]): number {
  if (values.length < 2 || values.length !== weights.length) return 0;
  
  const mean = weightedMean(values, weights);
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < values.length; i++) {
    numerator += weights[i] * Math.pow(values[i] - mean, 2);
    denominator += weights[i];
  }
  
  return denominator > 0 ? Math.sqrt(numerator / denominator) : 0;
}

/**
 * Weighted sum
 */
export function weightedSum(values: number[], weights: number[]): number {
  if (values.length === 0 || values.length !== weights.length) return 0;
  
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] * weights[i];
  }
  return sum;
}

/**
 * Weighted median (approximate via weighted percentile)
 */
export function weightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  
  // Create sorted pairs
  const pairs = values
    .map((v, i) => ({ value: v, weight: weights[i] }))
    .sort((a, b) => a.value - b.value);
  
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const halfWeight = totalWeight / 2;
  
  let cumWeight = 0;
  for (const pair of pairs) {
    cumWeight += pair.weight;
    if (cumWeight >= halfWeight) {
      return pair.value;
    }
  }
  
  return pairs[pairs.length - 1].value;
}

/**
 * Weighted coefficient of variation (CV)
 * 
 * CV = std / mean
 */
export function weightedCV(values: number[], weights: number[]): number {
  const mean = weightedMean(values, weights);
  if (mean === 0) return 999; // Undefined, return high value
  
  const std = weightedStd(values, weights);
  return std / mean;
}

/**
 * Normalize weights to sum to 1
 */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum === 0) return weights.map(() => 0);
  return weights.map(w => w / sum);
}
