/**
 * Early Signal Detector v1
 * 
 * Alpha radar layer built on top of Trend-Adjusted Score v0.5.
 * 
 * NOT a rating. NOT part of influence score.
 * It's a watchlist / radar / alpha-detector.
 * 
 * Question: "Can this account become important soon?"
 * 
 * Formula:
 *   growth_pressure = 0.6 * acceleration_norm + 0.4 * velocity_norm
 *   relative_gap = (adjusted - base) / max(base, 1)
 *   early_raw = growth_pressure * profile_factor + relative_gap - risk_penalty
 *   early_signal_score = clamp(early_raw, 0, 1) * 1000
 */

import { 
  EarlySignalConfig, 
  type EarlySignalProfile, 
  type EarlySignalRisk, 
  type EarlySignalBadge 
} from './early-signal-config.js'

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x))
}

export interface EarlySignalInput {
  influence_base: number          // base influence_score (0..1000)
  influence_adjusted: number      // trend_adjusted.influence.score (0..1000)
  trend: {
    velocity_norm: number         // -1..1
    acceleration_norm: number     // -1..1
  }
  signal_noise: number            // 0..10
  risk_level: EarlySignalRisk
  profile: EarlySignalProfile
}

export interface EarlySignalResult {
  early_signal_score: number      // 0..1000
  badge: EarlySignalBadge
  confidence: number              // 0..1
  reasons: string[]
  components: {
    growth_pressure: number
    relative_gap: number
    profile_factor: number
    risk_penalty: number
    raw_score: number
  }
}

/**
 * Compute Early Signal from existing data layers
 * 
 * @example
 * computeEarlySignal({
 *   influence_base: 480,
 *   influence_adjusted: 650,
 *   trend: { velocity_norm: 0.4, acceleration_norm: 0.6 },
 *   signal_noise: 7.2,
 *   risk_level: 'low',
 *   profile: 'retail'
 * })
 * // → { early_signal_score: 782, badge: 'breakout', ... }
 */
export function computeEarlySignal(input: EarlySignalInput): EarlySignalResult {
  const cfg = EarlySignalConfig
  
  // 1. Growth Pressure
  const growthPressure = 
    cfg.weights.acceleration * input.trend.acceleration_norm +
    cfg.weights.velocity * input.trend.velocity_norm
  
  // 2. Relative Gap (how much trend boosted the account)
  const relativeGap = 
    (input.influence_adjusted - input.influence_base) / 
    Math.max(input.influence_base, 1)
  
  // 3. Profile factor
  const profileFactor = cfg.profile_factor[input.profile] ?? 0.5
  
  // 4. Risk penalty
  const riskPenalty = cfg.risk_penalty[input.risk_level] ?? 0
  
  // 5. Raw score
  const rawScore = 
    growthPressure * profileFactor + 
    relativeGap - 
    riskPenalty
  
  // 6. Final score (0..1000)
  const score = clamp(rawScore, 0, 1) * 1000
  
  // 7. Badge logic
  let badge: EarlySignalBadge = 'none'
  
  if (score >= cfg.thresholds.rising) {
    // Check for breakout conditions
    if (
      input.trend.acceleration_norm >= cfg.thresholds.breakout_accel_min &&
      input.risk_level !== 'high'
    ) {
      badge = 'breakout'
    } else {
      badge = 'rising'
    }
  } else if (score >= cfg.thresholds.none) {
    badge = 'rising'
  }
  
  // 8. Build reasons (for UI/explain)
  const reasons: string[] = []
  
  if (input.trend.acceleration_norm > 0.3) {
    reasons.push('Growth acceleration above average')
  }
  
  if (relativeGap > 0.2) {
    reasons.push('Trend significantly boosted influence')
  }
  
  if (input.profile === 'retail') {
    reasons.push('Early account — higher growth potential')
  }
  
  if (input.profile === 'whale') {
    reasons.push('Large account — less potential for "early" growth')
  }
  
  if (input.risk_level !== 'low') {
    reasons.push('Risks present, signal weakened')
  }
  
  if (growthPressure > 0.5) {
    reasons.push('High growth pressure')
  }
  
  // 9. Confidence (how sure we are about this signal)
  const confidence = clamp(
    (Math.abs(growthPressure) + Math.abs(relativeGap)) / 2,
    0,
    1
  )
  
  return {
    early_signal_score: Math.round(score),
    badge,
    confidence: Number(confidence.toFixed(3)),
    reasons,
    components: {
      growth_pressure: Number(growthPressure.toFixed(3)),
      relative_gap: Number(relativeGap.toFixed(3)),
      profile_factor: profileFactor,
      risk_penalty: riskPenalty,
      raw_score: Number(rawScore.toFixed(3)),
    },
  }
}

/**
 * Quick check if account has early signal
 */
export function hasEarlySignal(result: EarlySignalResult): boolean {
  return result.badge !== 'none'
}

/**
 * Check if account is breakout candidate
 */
export function isBreakout(result: EarlySignalResult): boolean {
  return result.badge === 'breakout'
}
