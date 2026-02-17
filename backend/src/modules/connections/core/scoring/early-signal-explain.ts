/**
 * Early Signal Explain Layer v1
 * 
 * Human-readable explanations for early signals.
 * Output in English for international users.
 */

import type { EarlySignalResult, EarlySignalInput } from './early-signal.js'
import type { EarlySignalBadge } from './early-signal-config.js'

/**
 * Get human-readable explanation
 */
export function explainEarlySignal(result: EarlySignalResult): string {
  if (result.badge === 'breakout') {
    return 'Early signal detected: account is rapidly gaining influence and may become significant soon.'
  }
  
  if (result.badge === 'rising') {
    return 'Account shows positive dynamics and deserves monitoring.'
  }
  
  return 'No significant early growth signals detected.'
}

/**
 * Get badge info for UI
 */
export function getEarlySignalBadge(badge: EarlySignalBadge): {
  label: string
  emoji: string
  color: 'green' | 'yellow' | 'gray'
  priority: number
} {
  switch (badge) {
    case 'breakout':
      return {
        label: 'Breakout',
        emoji: '🚀',
        color: 'green',
        priority: 3,
      }
    case 'rising':
      return {
        label: 'Rising',
        emoji: '📈',
        color: 'yellow',
        priority: 2,
      }
    default:
      return {
        label: 'No Signal',
        emoji: '➖',
        color: 'gray',
        priority: 1,
      }
  }
}

/**
 * Compare two accounts by early signal
 */
export function compareEarlySignals(
  a: EarlySignalResult,
  b: EarlySignalResult
): {
  stronger: 'a' | 'b' | 'tie'
  score_diff: number
  recommendation: string
} {
  const badgePriority = { none: 0, rising: 1, breakout: 2 }
  
  const priorityA = badgePriority[a.badge]
  const priorityB = badgePriority[b.badge]
  
  let stronger: 'a' | 'b' | 'tie' = 'tie'
  
  if (priorityA > priorityB) {
    stronger = 'a'
  } else if (priorityB > priorityA) {
    stronger = 'b'
  } else if (a.early_signal_score > b.early_signal_score + 50) {
    stronger = 'a'
  } else if (b.early_signal_score > a.early_signal_score + 50) {
    stronger = 'b'
  }
  
  let recommendation: string
  
  if (stronger === 'tie') {
    recommendation = 'Both accounts have similar early growth potential.'
  } else if (stronger === 'a') {
    if (a.badge === 'breakout') {
      recommendation = 'A shows strong breakout signal — priority monitoring recommended.'
    } else {
      recommendation = 'A shows stronger early growth dynamics.'
    }
  } else {
    if (b.badge === 'breakout') {
      recommendation = 'B shows strong breakout signal — priority monitoring recommended.'
    } else {
      recommendation = 'B shows stronger early growth dynamics.'
    }
  }
  
  return {
    stronger,
    score_diff: a.early_signal_score - b.early_signal_score,
    recommendation,
  }
}

/**
 * Get watchlist recommendation based on early signal
 */
export function getWatchlistRecommendation(result: EarlySignalResult): {
  action: 'add' | 'watch' | 'ignore'
  reason: string
} {
  if (result.badge === 'breakout' && result.confidence >= 0.5) {
    return {
      action: 'add',
      reason: 'High breakout potential with good confidence',
    }
  }
  
  if (result.badge === 'rising' || (result.badge === 'breakout' && result.confidence < 0.5)) {
    return {
      action: 'watch',
      reason: 'Positive dynamics, needs monitoring',
    }
  }
  
  return {
    action: 'ignore',
    reason: 'No significant early growth signals',
  }
}
