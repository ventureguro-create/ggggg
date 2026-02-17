/**
 * Trend-Adjust Explain Layer v0.5
 * 
 * Human-readable explanations for trend adjustments.
 * Output in Russian for product consistency.
 */

import type { TrendAdjustResult } from './trend-adjust.js'
import type { TrendState } from './connections-trends.js'

/**
 * Explain single adjustment
 */
export function explainTrendAdjustment(params: {
  delta: number
  multiplier: number
  delta_percent: number
  state?: TrendState
}): string {
  const { delta, multiplier, delta_percent, state } = params
  
  if (Math.abs(delta_percent) < 3) {
    return 'Тренд не оказывает значимого влияния на рейтинг.'
  }
  
  if (delta > 0) {
    const intensity = delta_percent >= 15 
      ? 'значительно усилен' 
      : 'усилен'
    const stateHint = state === 'growing' 
      ? 'Аккаунт находится в фазе активного роста.' 
      : 'Наблюдается положительная динамика.'
    return `Рейтинг ${intensity} трендом (×${multiplier}, +${delta_percent}%). ${stateHint}`
  }
  
  if (delta < 0) {
    const intensity = delta_percent <= -15 
      ? 'существенно снижен' 
      : 'скорректирован'
    const stateHint = state === 'cooling' 
      ? 'Аккаунт теряет позиции.' 
      : 'Наблюдается негативная динамика.'
    return `Рейтинг ${intensity} из-за тренда (×${multiplier}, ${delta_percent}%). ${stateHint}`
  }
  
  return 'Тренд стабилен.'
}

/**
 * Get short badge/label for UI
 */
export function getTrendAdjustBadge(params: {
  delta: number
  delta_percent: number
  state?: TrendState
}): {
  label: string
  emoji: string
  color: 'green' | 'red' | 'yellow' | 'gray'
} {
  const { delta, delta_percent, state } = params
  
  // Strong growth
  if (delta_percent >= 15) {
    return { label: 'Рост', emoji: '🚀', color: 'green' }
  }
  
  // Moderate growth
  if (delta_percent >= 5) {
    return { label: 'Тренд+', emoji: '📈', color: 'green' }
  }
  
  // Strong decline
  if (delta_percent <= -15) {
    return { label: 'Падение', emoji: '📉', color: 'red' }
  }
  
  // Moderate decline
  if (delta_percent <= -5) {
    return { label: 'Тренд-', emoji: '↘️', color: 'red' }
  }
  
  // Volatile
  if (state === 'volatile') {
    return { label: 'Нестабильно', emoji: '⚡', color: 'yellow' }
  }
  
  // Stable
  return { label: 'Стабильно', emoji: '➖', color: 'gray' }
}

/**
 * Compare two accounts by trend-adjusted scores
 */
export function compareTrendAdjusted(params: {
  a: { base: number; adjusted: number; delta_percent: number }
  b: { base: number; adjusted: number; delta_percent: number }
}): {
  winner: 'a' | 'b' | 'tie'
  base_diff: number
  adjusted_diff: number
  trend_impact: string
} {
  const { a, b } = params
  
  const baseDiff = a.base - b.base
  const adjustedDiff = a.adjusted - b.adjusted
  
  let winner: 'a' | 'b' | 'tie' = 'tie'
  if (adjustedDiff > 20) winner = 'a'
  else if (adjustedDiff < -20) winner = 'b'
  
  // Analyze trend impact
  let trendImpact: string
  
  // Case: B was losing but trend saved them
  if (baseDiff > 0 && adjustedDiff <= 0) {
    trendImpact = 'B догоняет благодаря положительному тренду.'
  }
  // Case: A was losing but trend saved them
  else if (baseDiff < 0 && adjustedDiff >= 0) {
    trendImpact = 'A догоняет благодаря положительному тренду.'
  }
  // Case: Trend amplified A's lead
  else if (baseDiff > 0 && adjustedDiff > baseDiff) {
    trendImpact = 'Тренд усиливает лидерство A.'
  }
  // Case: Trend amplified B's lead
  else if (baseDiff < 0 && adjustedDiff < baseDiff) {
    trendImpact = 'Тренд усиливает лидерство B.'
  }
  // Case: Trend reduced A's lead
  else if (baseDiff > 0 && adjustedDiff < baseDiff) {
    trendImpact = 'A впереди, но B демонстрирует лучшую динамику.'
  }
  // Case: Trend reduced B's lead
  else if (baseDiff < 0 && adjustedDiff > baseDiff) {
    trendImpact = 'B впереди, но A демонстрирует лучшую динамику.'
  }
  else {
    trendImpact = 'Тренд не меняет расстановку сил.'
  }
  
  return {
    winner,
    base_diff: baseDiff,
    adjusted_diff: adjustedDiff,
    trend_impact: trendImpact,
  }
}
