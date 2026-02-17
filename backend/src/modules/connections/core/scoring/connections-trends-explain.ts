/**
 * Trends Explain Layer
 * 
 * Human-readable explanations for trend results.
 * Russian language by default.
 */

import type { TrendResult } from './connections-trends.js'

export type TrendExplanation = {
  summary: string
  bullets: string[]
  emoji: string
  recommendation?: string
}

/**
 * Generate human-readable explanation for trend result
 */
export function explainTrends(trend: TrendResult): TrendExplanation {
  const bullets: string[] = []
  let summary = ''
  let emoji = '📊'
  let recommendation: string | undefined

  // State-based summary
  switch (trend.state) {
    case 'growing':
      summary = 'Влияние аккаунта растёт'
      emoji = '🚀'
      if (trend.acceleration_norm > 0.3) {
        bullets.push('Рост ускоряется — аккаунт набирает обороты.')
        recommendation = 'Хороший момент для коллаборации — аккаунт на подъёме.'
      } else {
        bullets.push('Стабильный органический рост.')
      }
      break

    case 'cooling':
      summary = 'Аккаунт теряет влияние'
      emoji = '📉'
      if (trend.acceleration_norm < -0.3) {
        bullets.push('Падение ускоряется — возможна проблема.')
        recommendation = 'Рекомендуется наблюдение перед принятием решений.'
      } else {
        bullets.push('Постепенное снижение активности аудитории.')
      }
      break

    case 'volatile':
      summary = 'Динамика нестабильна'
      emoji = '⚡'
      bullets.push('Резкие колебания влияния — возможен хайп или манипуляции.')
      recommendation = 'Требуется дополнительный анализ причин волатильности.'
      break

    case 'stable':
    default:
      summary = 'Влияние стабильно'
      emoji = '➖'
      bullets.push('Аккаунт поддерживает постоянный уровень влияния.')
      break
  }

  // Velocity details
  const absVelocity = Math.abs(trend.velocity)
  if (absVelocity > 30) {
    bullets.push(`Высокая скорость изменения: ${trend.velocity > 0 ? '+' : ''}${trend.velocity.toFixed(1)} пунктов/день.`)
  } else if (absVelocity > 10) {
    bullets.push(`Умеренная динамика: ${trend.velocity > 0 ? '+' : ''}${trend.velocity.toFixed(1)} пунктов/день.`)
  } else if (absVelocity > 0) {
    bullets.push(`Минимальные изменения: ${trend.velocity > 0 ? '+' : ''}${trend.velocity.toFixed(1)} пунктов/день.`)
  }

  // Confidence warning
  if (trend.confidence < 0.3 && trend.data_points >= 3) {
    bullets.push(`Низкая достоверность тренда (R²=${trend.confidence.toFixed(2)}) — данные сильно разбросаны.`)
  } else if (trend.confidence > 0.8) {
    bullets.push(`Высокая достоверность тренда (R²=${trend.confidence.toFixed(2)}).`)
  }

  // Data quality
  if (trend.data_points < 7) {
    bullets.push(`Мало данных (${trend.data_points} точек) — тренд может быть неточным.`)
  }

  return {
    summary,
    bullets,
    emoji,
    recommendation,
  }
}

/**
 * Generate short label for UI badge
 */
export function getTrendBadge(trend: TrendResult): {
  label: string
  color: 'green' | 'red' | 'yellow' | 'gray'
} {
  switch (trend.state) {
    case 'growing':
      return { label: 'Growing', color: 'green' }
    case 'cooling':
      return { label: 'Cooling', color: 'red' }
    case 'volatile':
      return { label: 'Volatile', color: 'yellow' }
    case 'stable':
    default:
      return { label: 'Stable', color: 'gray' }
  }
}

/**
 * Format velocity for display
 */
export function formatVelocity(velocity: number): string {
  if (velocity > 0) {
    return `+${velocity.toFixed(1)}/day`
  } else if (velocity < 0) {
    return `${velocity.toFixed(1)}/day`
  }
  return '0/day'
}

/**
 * Compare two trend results
 */
export function compareTrends(
  trendA: TrendResult,
  trendB: TrendResult
): {
  faster: 'A' | 'B' | 'TIE'
  accelerating_more: 'A' | 'B' | 'TIE'
  summary: string
} {
  const velocityDiff = trendA.velocity - trendB.velocity
  const accelDiff = trendA.acceleration - trendB.acceleration

  const faster: 'A' | 'B' | 'TIE' =
    Math.abs(velocityDiff) < 2 ? 'TIE' : velocityDiff > 0 ? 'A' : 'B'

  const accelerating_more: 'A' | 'B' | 'TIE' =
    Math.abs(accelDiff) < 1 ? 'TIE' : accelDiff > 0 ? 'A' : 'B'

  let summary = ''
  if (faster === 'TIE' && accelerating_more === 'TIE') {
    summary = 'Оба аккаунта развиваются схожими темпами.'
  } else if (faster === 'A') {
    summary = accelerating_more === 'A'
      ? 'A растёт быстрее и ускоряется.'
      : 'A растёт быстрее, но B ускоряется сильнее.'
  } else if (faster === 'B') {
    summary = accelerating_more === 'B'
      ? 'B растёт быстрее и ускоряется.'
      : 'B растёт быстрее, но A ускоряется сильнее.'
  } else {
    summary = accelerating_more === 'A'
      ? 'Скорости схожи, но A ускоряется быстрее.'
      : 'Скорости схожи, но B ускоряется быстрее.'
  }

  return { faster, accelerating_more, summary }
}
