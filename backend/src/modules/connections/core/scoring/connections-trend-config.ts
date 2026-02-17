/**
 * Connections Trend Config v0.5
 * 
 * Configuration for trend-adjusted scoring.
 * Separates influence and x_score parameters for fine-tuning.
 * 
 * multiplier = 1 + k_velocity * velocity_norm + k_acceleration * acceleration_norm
 * bounded to [min_boost, max_boost]
 */

export interface TrendAdjustConfig {
  k_velocity: number      // Weight for velocity (-1..1)
  k_acceleration: number  // Weight for acceleration (-1..1)
  min_boost: number       // Floor multiplier (e.g., 0.8 = -20%)
  max_boost: number       // Ceiling multiplier (e.g., 1.25 = +25%)
}

export const ConnectionsTrendConfig = {
  version: '0.5.0',
  
  /**
   * Influence Score adjustment
   * More aggressive - velocity dominates
   */
  influence: {
    k_velocity: 0.35,
    k_acceleration: 0.15,
    min_boost: 0.80,   // Max -20%
    max_boost: 1.25,   // Max +25%
  } as TrendAdjustConfig,

  /**
   * X-Score adjustment
   * More conservative - smaller swings
   */
  x_score: {
    k_velocity: 0.20,
    k_acceleration: 0.10,
    min_boost: 0.85,   // Max -15%
    max_boost: 1.15,   // Max +15%
  } as TrendAdjustConfig,
}

/**
 * Get config by score type
 */
export function getTrendConfig(scoreType: 'influence' | 'x'): TrendAdjustConfig {
  return scoreType === 'influence' 
    ? ConnectionsTrendConfig.influence 
    : ConnectionsTrendConfig.x_score
}
