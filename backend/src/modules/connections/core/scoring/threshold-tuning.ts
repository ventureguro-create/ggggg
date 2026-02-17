/**
 * Threshold Tuning Matrix v1
 * 
 * Calibration & Stability Layer for Connections Scoring v0.5+
 * 
 * Purpose:
 * - Measure model sensitivity to parameter changes
 * - Identify dangerous thresholds
 * - Ensure stability before connecting live data (Twitter)
 * 
 * Metrics:
 * - Rank Shift Sensitivity: how much account ranking changes
 * - Early Signal Flip Rate: how many badges change
 * - Stability Score: overall model stability (0..1)
 */

import { computeEarlySignal, type EarlySignalInput } from './early-signal.js'
import { applyTrendAdjustment } from './trend-adjust.js'
import { EarlySignalConfig } from './early-signal-config.js'
import { ConnectionsTrendConfig } from './connections-trend-config.js'

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x))
}

// ============================================================
// TYPES
// ============================================================

export interface TuningAccount {
  id: string
  influence_base: number
  trend: {
    velocity_norm: number
    acceleration_norm: number
  }
  signal_noise: number
  risk_level: 'low' | 'medium' | 'high'
  profile: 'retail' | 'influencer' | 'whale'
}

export interface ScoredAccount {
  id: string
  adjusted_score: number
  early_badge: 'none' | 'rising' | 'breakout'
  early_score: number
}

export interface TuningResult {
  delta: number
  rank_shift: number           // average position change
  early_flip_rate: number      // % of badge changes
  stability_score: number      // 0..1 (higher = more stable)
  interpretation: string
}

export interface TuningMatrixResult {
  parameter: string
  results: TuningResult[]
  recommendation: {
    safe_range: [number, number]
    optimal_delta: number
    warning: string | null
  }
}

// ============================================================
// CORE SCORING FUNCTION
// ============================================================

function scoreAllAccounts(dataset: TuningAccount[]): ScoredAccount[] {
  return dataset.map(acc => {
    const adjusted = applyTrendAdjustment({
      base_score: acc.influence_base,
      velocity_norm: acc.trend.velocity_norm,
      acceleration_norm: acc.trend.acceleration_norm,
      score_type: 'influence',
    })
    
    const early = computeEarlySignal({
      influence_base: acc.influence_base,
      influence_adjusted: adjusted.adjusted_score,
      trend: acc.trend,
      signal_noise: acc.signal_noise,
      risk_level: acc.risk_level,
      profile: acc.profile,
    })
    
    return {
      id: acc.id,
      adjusted_score: adjusted.adjusted_score,
      early_badge: early.badge,
      early_score: early.early_signal_score,
    }
  })
}

// ============================================================
// METRIC CALCULATIONS
// ============================================================

function computeRankShift(before: ScoredAccount[], after: ScoredAccount[]): number {
  // Sort by adjusted score descending
  const rankBefore = new Map(
    [...before]
      .sort((a, b) => b.adjusted_score - a.adjusted_score)
      .map((acc, idx) => [acc.id, idx])
  )
  
  const rankAfter = new Map(
    [...after]
      .sort((a, b) => b.adjusted_score - a.adjusted_score)
      .map((acc, idx) => [acc.id, idx])
  )
  
  let totalShift = 0
  for (const id of rankBefore.keys()) {
    const posBefore = rankBefore.get(id)!
    const posAfter = rankAfter.get(id) ?? posBefore
    totalShift += Math.abs(posBefore - posAfter)
  }
  
  return totalShift / Math.max(rankBefore.size, 1)
}

function computeEarlyFlipRate(before: ScoredAccount[], after: ScoredAccount[]): number {
  let flips = 0
  
  const afterMap = new Map(after.map(a => [a.id, a]))
  
  for (const acc of before) {
    const afterAcc = afterMap.get(acc.id)
    if (afterAcc && acc.early_badge !== afterAcc.early_badge) {
      flips++
    }
  }
  
  return flips / Math.max(before.length, 1)
}

function normalizeRankShift(shift: number): number {
  // Normalize: 0 = no change, 1 = massive change (10+ average positions)
  return clamp(shift / 10, 0, 1)
}

function computeStabilityScore(rankShift: number, flipRate: number): number {
  // Higher = more stable
  // Formula: 1 - (weighted sum of instability metrics)
  return 1 - clamp(
    0.4 * normalizeRankShift(rankShift) +
    0.4 * flipRate +
    0.2 * flipRate, // extra weight on flips (UI impact)
    0,
    1
  )
}

function interpretStability(stability: number): string {
  if (stability >= 0.8) return 'Высокая стабильность — безопасно'
  if (stability >= 0.6) return 'Умеренная стабильность — приемлемо'
  if (stability >= 0.4) return 'Низкая стабильность — требует внимания'
  return 'Критически нестабильно — опасный порог'
}

// ============================================================
// PARAMETER MUTATION HELPERS
// ============================================================

type ParameterPath = 
  | 'trend.k_velocity'
  | 'trend.k_acceleration'
  | 'trend.min_boost'
  | 'trend.max_boost'
  | 'early.none_threshold'
  | 'early.rising_threshold'
  | 'early.breakout_accel_min'

function applyParameterDelta(param: ParameterPath, delta: number): void {
  switch (param) {
    case 'trend.k_velocity':
      ConnectionsTrendConfig.influence.k_velocity += delta
      break
    case 'trend.k_acceleration':
      ConnectionsTrendConfig.influence.k_acceleration += delta
      break
    case 'trend.min_boost':
      ConnectionsTrendConfig.influence.min_boost += delta
      break
    case 'trend.max_boost':
      ConnectionsTrendConfig.influence.max_boost += delta
      break
    case 'early.none_threshold':
      EarlySignalConfig.thresholds.none += delta * 100
      break
    case 'early.rising_threshold':
      EarlySignalConfig.thresholds.rising += delta * 100
      break
    case 'early.breakout_accel_min':
      EarlySignalConfig.thresholds.breakout_accel_min += delta
      break
  }
}

function resetParameter(param: ParameterPath, originalValue: number): void {
  switch (param) {
    case 'trend.k_velocity':
      ConnectionsTrendConfig.influence.k_velocity = originalValue
      break
    case 'trend.k_acceleration':
      ConnectionsTrendConfig.influence.k_acceleration = originalValue
      break
    case 'trend.min_boost':
      ConnectionsTrendConfig.influence.min_boost = originalValue
      break
    case 'trend.max_boost':
      ConnectionsTrendConfig.influence.max_boost = originalValue
      break
    case 'early.none_threshold':
      EarlySignalConfig.thresholds.none = originalValue
      break
    case 'early.rising_threshold':
      EarlySignalConfig.thresholds.rising = originalValue
      break
    case 'early.breakout_accel_min':
      EarlySignalConfig.thresholds.breakout_accel_min = originalValue
      break
  }
}

function getParameterValue(param: ParameterPath): number {
  switch (param) {
    case 'trend.k_velocity':
      return ConnectionsTrendConfig.influence.k_velocity
    case 'trend.k_acceleration':
      return ConnectionsTrendConfig.influence.k_acceleration
    case 'trend.min_boost':
      return ConnectionsTrendConfig.influence.min_boost
    case 'trend.max_boost':
      return ConnectionsTrendConfig.influence.max_boost
    case 'early.none_threshold':
      return EarlySignalConfig.thresholds.none
    case 'early.rising_threshold':
      return EarlySignalConfig.thresholds.rising
    case 'early.breakout_accel_min':
      return EarlySignalConfig.thresholds.breakout_accel_min
    default:
      return 0
  }
}

// ============================================================
// MAIN TUNING FUNCTION
// ============================================================

/**
 * Run threshold tuning analysis for a specific parameter
 * 
 * @param dataset - Array of test accounts
 * @param parameter - Parameter to tune (e.g., 'trend.k_velocity')
 * @param deltas - Array of delta values to test (e.g., [-0.2, -0.1, 0, 0.1, 0.2])
 */
export function runThresholdTuning(
  dataset: TuningAccount[],
  parameter: ParameterPath,
  deltas: number[]
): TuningMatrixResult {
  // Get baseline scores
  const baseScores = scoreAllAccounts(dataset)
  
  // Save original value
  const originalValue = getParameterValue(parameter)
  
  // Test each delta
  const results: TuningResult[] = deltas.map(delta => {
    // Apply delta
    applyParameterDelta(parameter, delta)
    
    // Score with new parameter
    const newScores = scoreAllAccounts(dataset)
    
    // Reset to original
    resetParameter(parameter, originalValue)
    
    // Calculate metrics
    const rankShift = computeRankShift(baseScores, newScores)
    const flipRate = computeEarlyFlipRate(baseScores, newScores)
    const stability = computeStabilityScore(rankShift, flipRate)
    
    return {
      delta,
      rank_shift: Number(rankShift.toFixed(2)),
      early_flip_rate: Number(flipRate.toFixed(3)),
      stability_score: Number(stability.toFixed(3)),
      interpretation: interpretStability(stability),
    }
  })
  
  // Find safe range (stability >= 0.6)
  const safeResults = results.filter(r => r.stability_score >= 0.6)
  const safeDeltas = safeResults.map(r => r.delta)
  
  const safeRange: [number, number] = safeDeltas.length > 0
    ? [Math.min(...safeDeltas), Math.max(...safeDeltas)]
    : [0, 0]
  
  // Find optimal (highest stability)
  const optimal = results.reduce((best, curr) => 
    curr.stability_score > best.stability_score ? curr : best
  , results[0])
  
  // Warning if stability is low
  const maxStability = Math.max(...results.map(r => r.stability_score))
  const warning = maxStability < 0.5
    ? 'Параметр критически нестабилен - рекомендуется пересмотр формулы'
    : null
  
  return {
    parameter,
    results,
    recommendation: {
      safe_range: safeRange,
      optimal_delta: optimal?.delta ?? 0,
      warning,
    },
  }
}

// ============================================================
// MOCK DATA GENERATOR
// ============================================================

/**
 * Generate mock dataset for tuning tests
 */
export function generateMockTuningDataset(size: number = 20): TuningAccount[] {
  const profiles: Array<'retail' | 'influencer' | 'whale'> = ['retail', 'influencer', 'whale']
  const risks: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']
  
  const accounts: TuningAccount[] = []
  
  for (let i = 0; i < size; i++) {
    const profile = profiles[i % 3]
    const risk = risks[Math.floor(Math.random() * 3)]
    
    // Base influence varies by profile
    let baseInfluence: number
    if (profile === 'whale') {
      baseInfluence = 600 + Math.random() * 300
    } else if (profile === 'influencer') {
      baseInfluence = 400 + Math.random() * 300
    } else {
      baseInfluence = 200 + Math.random() * 300
    }
    
    accounts.push({
      id: `mock_${i.toString().padStart(3, '0')}`,
      influence_base: Math.round(baseInfluence),
      trend: {
        velocity_norm: (Math.random() * 2 - 1) * 0.8, // -0.8..0.8
        acceleration_norm: (Math.random() * 2 - 1) * 0.6, // -0.6..0.6
      },
      signal_noise: Math.random() * 8,
      risk_level: risk,
      profile,
    })
  }
  
  return accounts
}

// ============================================================
// FULL MATRIX ANALYSIS
// ============================================================

/**
 * Run full tuning matrix for all key parameters
 */
export function runFullTuningMatrix(dataset: TuningAccount[]): {
  parameters: TuningMatrixResult[]
  overall_stability: number
  recommendations: string[]
} {
  const deltas = [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2]
  
  const parameters: ParameterPath[] = [
    'trend.k_velocity',
    'trend.k_acceleration',
    'early.breakout_accel_min',
  ]
  
  const results = parameters.map(param => 
    runThresholdTuning(dataset, param, deltas)
  )
  
  // Overall stability = average of optimal stabilities
  const overallStability = results.reduce((sum, r) => {
    const maxStab = Math.max(...r.results.map(res => res.stability_score))
    return sum + maxStab
  }, 0) / results.length
  
  // Build recommendations
  const recommendations: string[] = []
  
  for (const result of results) {
    if (result.recommendation.warning) {
      recommendations.push(`⚠️ ${result.parameter}: ${result.recommendation.warning}`)
    } else if (result.recommendation.safe_range[0] === result.recommendation.safe_range[1]) {
      recommendations.push(`⚠️ ${result.parameter}: Узкий безопасный диапазон`)
    }
  }
  
  if (overallStability >= 0.7) {
    recommendations.push('✅ Модель достаточно стабильна для подключения live данных')
  } else {
    recommendations.push('⚠️ Рекомендуется дополнительная калибровка перед подключением Twitter')
  }
  
  return {
    parameters: results,
    overall_stability: Number(overallStability.toFixed(3)),
    recommendations,
  }
}
