/**
 * Connections Trends Engine v0.1
 * 
 * Calculates velocity (rate of change) and acceleration 
 * from historical score series.
 * 
 * Pure math layer - no Twitter, no DB dependencies.
 * 
 * Velocity = slope of influence over time (points/day)
 * Acceleration = change in velocity (recent vs past)
 * State = human classification (growing/cooling/stable/volatile)
 */

import { computeVelocity, computeVelocityWithConfidence } from './trends-linear.js'

export type TimePoint = {
  ts: number        // timestamp in ms
  influence: number // 0..1000
  x_score?: number  // 0..1000 (optional)
}

export type TrendInput = {
  author_id: string
  window_days: number
  series: TimePoint[] // sorted by ts ASC
}

export type TrendState = 'growing' | 'cooling' | 'stable' | 'volatile'

export type TrendResult = {
  velocity: number          // points/day
  acceleration: number      // points/day² (relative)
  velocity_norm: number     // -1..1 normalized
  acceleration_norm: number // -1..1 normalized
  state: TrendState
  confidence: number        // R² of linear fit (0..1)
  data_points: number       // how many points used
}

// Configuration
const VELOCITY_SCALE = 50   // ±50 points/day → ±1 norm
const ACCEL_SCALE = 20      // ±20 points/day² → ±1 norm
const GROWING_THRESHOLD = 0.2
const COOLING_THRESHOLD = -0.2
const ACCEL_THRESHOLD = 0.1
const VOLATILE_THRESHOLD = 0.5

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x))
}

function round(x: number, decimals: number = 2): number {
  const p = 10 ** decimals
  return Math.round(x * p) / p
}

/**
 * Compute trends from historical score series
 */
export function computeTrends(input: TrendInput): TrendResult {
  const series = input.series || []
  
  // Not enough data
  if (series.length < 3) {
    return {
      velocity: 0,
      acceleration: 0,
      velocity_norm: 0,
      acceleration_norm: 0,
      state: 'stable',
      confidence: 0,
      data_points: series.length,
    }
  }

  // Sort by timestamp (safety)
  const sorted = [...series].sort((a, b) => a.ts - b.ts)
  const n = sorted.length

  // Split into past (2/3) and recent (1/3)
  const splitIdx = Math.floor(n * 2 / 3)
  const past = sorted.slice(0, splitIdx)
  const recent = sorted.slice(splitIdx)

  // Compute velocities
  const fullPoints = sorted.map(p => ({ ts: p.ts, value: p.influence }))
  const pastPoints = past.map(p => ({ ts: p.ts, value: p.influence }))
  const recentPoints = recent.map(p => ({ ts: p.ts, value: p.influence }))

  const { velocity: vAll, r2: confidence } = computeVelocityWithConfidence(fullPoints)
  const vPast = computeVelocity(pastPoints)
  const vRecent = computeVelocity(recentPoints)

  // Acceleration = change in velocity
  const acceleration = vRecent - vPast

  // Normalize to -1..1
  const velocityNorm = clamp(vAll / VELOCITY_SCALE, -1, 1)
  const accelNorm = clamp(acceleration / ACCEL_SCALE, -1, 1)

  // Determine state
  let state: TrendState = 'stable'

  if (velocityNorm > GROWING_THRESHOLD && accelNorm > ACCEL_THRESHOLD) {
    state = 'growing'
  } else if (velocityNorm < COOLING_THRESHOLD && accelNorm < -ACCEL_THRESHOLD) {
    state = 'cooling'
  } else if (Math.abs(accelNorm) > VOLATILE_THRESHOLD) {
    state = 'volatile'
  } else if (velocityNorm > GROWING_THRESHOLD) {
    state = 'growing' // Growing but decelerating
  } else if (velocityNorm < COOLING_THRESHOLD) {
    state = 'cooling' // Cooling but accelerating (less negative)
  }

  return {
    velocity: round(vAll, 2),
    acceleration: round(acceleration, 2),
    velocity_norm: round(velocityNorm, 3),
    acceleration_norm: round(accelNorm, 3),
    state,
    confidence: round(confidence, 3),
    data_points: n,
  }
}

/**
 * Compute trends for X-score instead of influence
 */
export function computeXTrends(input: TrendInput): TrendResult {
  const series = input.series || []
  
  // Transform to use x_score
  const xSeries = series
    .filter(p => p.x_score !== undefined)
    .map(p => ({ ...p, influence: p.x_score! }))

  return computeTrends({ ...input, series: xSeries })
}

/**
 * Compute both influence and x trends
 */
export function computeFullTrends(input: TrendInput): {
  influence: TrendResult
  x: TrendResult
} {
  return {
    influence: computeTrends(input),
    x: computeXTrends(input),
  }
}

/**
 * Generate mock trend data for testing
 */
export function generateMockTrendSeries(
  days: number = 30,
  baseScore: number = 500,
  trend: 'up' | 'down' | 'stable' | 'volatile' = 'up'
): TimePoint[] {
  const now = Date.now()
  const msPerDay = 86400000
  const points: TimePoint[] = []

  for (let i = days; i >= 0; i--) {
    const ts = now - i * msPerDay
    let influence = baseScore
    let x_score = baseScore * 0.8
    const noise = Math.random() * 8 - 4 // Small noise

    switch (trend) {
      case 'up':
        // Strong upward: ~20 points/day with acceleration in recent period
        const dayFromStart = days - i
        influence += dayFromStart * 20 + (dayFromStart > days * 0.6 ? dayFromStart * 5 : 0) + noise
        x_score += dayFromStart * 15 + noise
        break
      case 'down':
        // Strong downward: ~18 points/day
        influence -= (days - i) * 18 + noise
        x_score -= (days - i) * 12 + noise
        break
      case 'volatile':
        // Large oscillations with high amplitude
        influence += Math.sin(i * 0.25) * 200 + Math.random() * 20 - 10
        x_score += Math.sin(i * 0.3) * 150 + Math.random() * 15 - 7
        break
      case 'stable':
      default:
        // Very small changes
        influence += noise
        x_score += noise * 0.8
    }

    points.push({
      ts,
      influence: Math.round(clamp(influence, 0, 1000)),
      x_score: Math.round(clamp(x_score, 0, 1000)),
    })
  }

  return points
}
