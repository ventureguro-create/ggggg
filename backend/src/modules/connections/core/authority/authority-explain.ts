/**
 * Authority Score Explain
 * 
 * Human-readable explanations for authority scores
 */

import { AuthorityExplain } from './authority-types.js';

/**
 * Generate explanation for authority score
 */
export function explainAuthority(authority01: number): AuthorityExplain {
  const drivers: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Authority level analysis
  if (authority01 >= 0.85) {
    drivers.push('Высочайшая authority-centrality: ключевой узел, влияющий на всю сеть.');
    drivers.push('Множественные сильные связи с другими высоко-authority узлами.');
  } else if (authority01 >= 0.75) {
    drivers.push('Высокая authority-centrality: узел влияет на многие части сети.');
    drivers.push('Устойчивое положение в ядре сетевых связей.');
  } else if (authority01 >= 0.55) {
    drivers.push('Средне-высокая authority-centrality: значимое влияние через связи.');
  } else if (authority01 >= 0.40) {
    drivers.push('Средняя authority-centrality: влияние держится через устойчивые связи.');
    concerns.push('Потенциал роста authority через укрепление связей.');
  } else if (authority01 >= 0.25) {
    concerns.push('Низко-средняя authority-centrality: влияние ограничено локальной группой.');
    concerns.push('Мало связей с ключевыми узлами сети.');
  } else {
    concerns.push('Низкая authority-centrality: влияние локальное или сеть слабая.');
    concerns.push('Отсутствие значимых связей с высоко-authority узлами.');
  }

  // Recommendations
  if (authority01 < 0.5) {
    recommendations.push('Укреплять связи с высоко-authority узлами (органически).');
    recommendations.push('Диверсифицировать аудиторию, снижать overlap и бот-риски.');
  }
  if (authority01 >= 0.5 && authority01 < 0.75) {
    recommendations.push('Поддерживать качество существующих связей.');
    recommendations.push('Расширять сеть через релевантные взаимодействия.');
  }
  if (authority01 >= 0.75) {
    recommendations.push('Сохранять позицию через активное участие в сети.');
    recommendations.push('Избегать действий, снижающих доверие сети.');
  }

  // Summary
  let summary: string;
  if (authority01 >= 0.85) {
    summary = 'Топ-узел сети с максимальной authority (elite tier).';
  } else if (authority01 >= 0.75) {
    summary = 'Один из ключевых узлов сети (high authority).';
  } else if (authority01 >= 0.55) {
    summary = 'Сильная позиция в сети (upper-mid authority).';
  } else if (authority01 >= 0.40) {
    summary = 'Устойчивая позиция в сети (mid authority).';
  } else if (authority01 >= 0.25) {
    summary = 'Ограниченное влияние в сети (low-mid authority).';
  } else {
    summary = 'Сеть не даёт значимой authority-поддержки (low authority).';
  }

  return {
    summary,
    drivers,
    concerns,
    recommendations,
  };
}

/**
 * Generate comparison explanation between two accounts
 */
export function explainAuthorityComparison(
  authorityA: number,
  authorityB: number
): string {
  const diff = authorityA - authorityB;
  const absDiff = Math.abs(diff);
  
  if (absDiff < 0.05) {
    return 'Оба аккаунта имеют схожий уровень authority в сети.';
  }
  
  const stronger = diff > 0 ? 'первый' : 'второй';
  const magnitude = absDiff >= 0.3 ? 'значительно' : absDiff >= 0.15 ? 'заметно' : 'немного';
  
  return `${stronger.charAt(0).toUpperCase() + stronger.slice(1)} аккаунт ${magnitude} сильнее по authority в сети.`;
}

/**
 * Get tier label for authority score
 */
export function getAuthorityTier(authority01: number): {
  tier: 'elite' | 'high' | 'upper-mid' | 'mid' | 'low-mid' | 'low';
  label: string;
  color: string;
} {
  if (authority01 >= 0.85) {
    return { tier: 'elite', label: 'Elite', color: '#8b5cf6' };
  }
  if (authority01 >= 0.75) {
    return { tier: 'high', label: 'High', color: '#22c55e' };
  }
  if (authority01 >= 0.55) {
    return { tier: 'upper-mid', label: 'Upper-Mid', color: '#3b82f6' };
  }
  if (authority01 >= 0.40) {
    return { tier: 'mid', label: 'Mid', color: '#06b6d4' };
  }
  if (authority01 >= 0.25) {
    return { tier: 'low-mid', label: 'Low-Mid', color: '#f59e0b' };
  }
  return { tier: 'low', label: 'Low', color: '#ef4444' };
}
