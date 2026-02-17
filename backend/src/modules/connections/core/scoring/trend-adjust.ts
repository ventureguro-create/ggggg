/**
 * Trend-Adjust Engine v0.5
 * 
 * Pure function to apply trend adjustment to base scores.
 * 
 * Formula:
 *   adjusted = base_score * bounded(1 + k_v*velocity_norm + k_a*accel_norm)
 * 
 * Why this approach:
 *   - Preserves base score as source of truth
 *   - Trend is multiplicative bonus/penalty
 *   - Bounded to prevent extreme swings
 *   - No side effects, no dependencies
 */

import { ConnectionsTrendConfig, getTrendConfig } from './connections-trend-config.js'

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x))
}

export interface TrendAdjustInput {
  base_score: number          // Original score (0..1000)
  velocity_norm: number       // Normalized velocity (-1..1)
  acceleration_norm: number   // Normalized acceleration (-1..1)
  score_type: 'influence' | 'x'
}

export interface TrendAdjustResult {
  adjusted_score: number      // New score with trend
  multiplier: number          // Applied multiplier (0.8..1.25)
  delta: number               // adjusted - base
  delta_percent: number       // % change
}

/**
 * Apply trend adjustment to a base score
 * 
 * @example
 * applyTrendAdjustment({
 *   base_score: 600,
 *   velocity_norm: 0.8,   // Strong upward
 *   acceleration_norm: 0.3, // Accelerating
 *   score_type: 'influence'
 * })
 * // → { adjusted_score: 705, multiplier: 1.175, delta: 105, delta_percent: 17.5 }
 */
export function applyTrendAdjustment(params: TrendAdjustInput): TrendAdjustResult {
  const { base_score, velocity_norm, acceleration_norm, score_type } = params
  
  // Get config for this score type
  const cfg = getTrendConfig(score_type)
  
  // Calculate raw multiplier
  const rawMultiplier = 1 + 
    cfg.k_velocity * velocity_norm + 
    cfg.k_acceleration * acceleration_norm
  
  // Bound to safe range
  const multiplier = clamp(rawMultiplier, cfg.min_boost, cfg.max_boost)
  
  // Apply to base score
  const adjusted = Math.round(base_score * multiplier)
  
  // Keep in valid range
  const bounded = clamp(adjusted, 0, 1000)
  
  const delta = bounded - base_score
  const deltaPercent = base_score > 0 
    ? Number(((delta / base_score) * 100).toFixed(1))
    : 0
  
  return {
    adjusted_score: bounded,
    multiplier: Number(multiplier.toFixed(3)),
    delta,
    delta_percent: deltaPercent,
  }
}

/**
 * Apply trend adjustment to both influence and x_score
 */
export function applyFullTrendAdjustment(params: {
  influence_score: number
  x_score: number
  velocity_norm: number
  acceleration_norm: number
}): {
  influence: TrendAdjustResult
  x: TrendAdjustResult
} {
  return {
    influence: applyTrendAdjustment({
      base_score: params.influence_score,
      velocity_norm: params.velocity_norm,
      acceleration_norm: params.acceleration_norm,
      score_type: 'influence',
    }),
    x: applyTrendAdjustment({
      base_score: params.x_score,
      velocity_norm: params.velocity_norm,
      acceleration_norm: params.acceleration_norm,
      score_type: 'x',
    }),
  }
}

/**
 * Quick check if trend has significant impact
 */
export function isTrendSignificant(result: TrendAdjustResult): boolean {
  return Math.abs(result.delta_percent) >= 5 // 5% threshold
}
