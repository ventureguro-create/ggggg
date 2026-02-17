/**
 * Smart Followers Explain Layer
 * 
 * Human-readable explanations for smart followers analysis
 */

import { SmartFollowersResult } from './smart-followers-types.js';
import { smartFollowersConfig as cfg } from './smart-followers-config.js';

function pct(x: number): number {
  return Math.round(x * 100);
}

/**
 * Generate explanations based on smart followers result
 */
export function explainSmartFollowers(r: SmartFollowersResult): {
  summary: string;
  drivers: string[];
  concerns: string[];
  recommendations: string[];
} {
  const drivers: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  const eliteShare = r.breakdown.elite_weight_share;
  const highShare = r.breakdown.high_weight_share;

  const top3 = r.top_followers.slice(0, 3);
  const top3Share = top3.reduce((a, b) => a + b.share_of_total, 0);

  // Score-based assessment
  if (r.smart_followers_score_0_1 >= 0.75) {
    drivers.push('Сильная аудитория: качество подписчиков компенсирует размер.');
  } else if (r.smart_followers_score_0_1 >= 0.45) {
    drivers.push('Нормальная аудитория: есть сильные подписчики, но потенциал роста качества остаётся.');
  } else {
    concerns.push('Низкое качество аудитории: мало сильных подписчиков, влияние слабо поддержано сетью.');
  }

  // Elite share assessment
  if (eliteShare >= cfg.thresholds.elite_share_high) {
    drivers.push(`Высокая доля elite-followers: ${pct(eliteShare)}% веса аудитории.`);
  } else if (eliteShare <= cfg.thresholds.elite_share_low) {
    concerns.push(`Мало elite-followers: всего ${pct(eliteShare)}% веса аудитории.`);
  }

  // High tier assessment
  if (highShare >= 0.25) {
    drivers.push(`Сильная high-tier поддержка: ${pct(highShare)}% веса от high-authority узлов.`);
  }

  // Concentration assessment
  if (top3Share >= cfg.thresholds.top_concentration_high) {
    concerns.push(`Сильная концентрация: top-3 дают ${pct(top3Share)}% веса аудитории (уязвимость, зависимость).`);
    recommendations.push('Диверсифицировать сильных подписчиков: расширять круг влиятельных связей.');
  } else {
    drivers.push('Хорошая диверсификация: влияние распределено между несколькими сильными узлами.');
  }

  // Small but smart assessment
  if (r.followers_count < cfg.thresholds.small_followers_n && r.smart_followers_score_0_1 >= 0.60) {
    drivers.push('Узкий круг сильных: аккаунт важен для инсайдерской сети (small-but-smart).');
    recommendations.push('Усилить публичный охват, не теряя качество: рост через коллаборации с сильными узлами.');
  }

  // General recommendations
  recommendations.push('Поддерживать органический рост: избегать накрутки, снижать overlap и бот-риски.');
  recommendations.push('Укреплять связи с high/elite узлами через совместные активности и качественный контент.');

  // Summary
  let summary: string;
  if (r.smart_followers_score_0_1 >= 0.75) {
    summary = 'Очень сильные подписчики: высокий smart-followers профиль.';
  } else if (r.smart_followers_score_0_1 >= 0.55) {
    summary = 'Хорошие подписчики: выше среднего smart-followers профиль.';
  } else if (r.smart_followers_score_0_1 >= 0.35) {
    summary = 'Средние подписчики: smart-followers профиль нормальный.';
  } else {
    summary = 'Слабые подписчики: smart-followers профиль низкий.';
  }

  return { summary, drivers, concerns, recommendations };
}

/**
 * Get tier label for display
 */
export function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    elite: 'Elite',
    high: 'High',
    upper_mid: 'Upper-Mid',
    mid: 'Mid',
    low_mid: 'Low-Mid',
    low: 'Low',
  };
  return labels[tier] || tier;
}

/**
 * Get tier color for UI
 */
export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    elite: '#8b5cf6',
    high: '#22c55e',
    upper_mid: '#3b82f6',
    mid: '#06b6d4',
    low_mid: '#f59e0b',
    low: '#ef4444',
  };
  return colors[tier] || '#6b7280';
}
