/**
 * Early Signal Config v1
 * 
 * Configuration for early signal detection.
 * Early Signal is NOT a rating - it's a radar/watchlist layer.
 * 
 * Question it answers: "Can this account become important soon?"
 */

export const EarlySignalConfig = {
  version: '1.0.0',

  /**
   * Growth pressure weights
   * acceleration matters more for "early" detection
   */
  weights: {
    acceleration: 0.6,
    velocity: 0.4,
  },

  /**
   * Profile factor - how much "early potential" each profile has
   * Whale can rarely be "early" - they're already established
   */
  profile_factor: {
    retail: 1.0,
    influencer: 0.75,
    whale: 0.4,
  } as Record<string, number>,

  /**
   * Risk penalties - high risk accounts can't be "breakout"
   */
  risk_penalty: {
    low: 0.0,
    medium: 0.2,
    high: 0.5,
  } as Record<string, number>,

  /**
   * Badge thresholds
   */
  thresholds: {
    none: 450,           // below this → no signal
    rising: 700,         // above this → rising
    breakout_accel_min: 0.4, // min acceleration for breakout
  },
}

export type EarlySignalProfile = 'retail' | 'influencer' | 'whale'
export type EarlySignalRisk = 'low' | 'medium' | 'high'
export type EarlySignalBadge = 'none' | 'rising' | 'breakout'
