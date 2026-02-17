/**
 * Connections Explain Layer
 * 
 * Generates human-readable explanations for scores.
 * NOT AI-generated - deterministic rules.
 * 
 * Critical for:
 * - User trust
 * - Transparency
 * - Debugging
 */

import { ConnectionsScoreResult, ConnectionsRedFlag } from './connections-engine.js';
import { ConnectionsScoringConfig } from './connections-config.js';

export interface ScoreExplanation {
  summary: string;           // One-line summary
  bullets: string[];         // 3-5 key points
  strengths: string[];       // What's good
  concerns: string[];        // What's concerning
  recommendation: string;    // Action recommendation
}

/**
 * Generate explanation for a score result
 */
export function explainScore(score: ConnectionsScoreResult): ScoreExplanation {
  const m = score.metrics;
  const bullets: string[] = [];
  const strengths: string[] = [];
  const concerns: string[] = [];

  // --- Engagement Quality ---
  if (m.engagement_quality > 0.6) {
    strengths.push('Высокое качество вовлечения: реакции соответствуют охвату.');
    bullets.push('Engagement quality is excellent (>60%).');
  } else if (m.engagement_quality > 0.3) {
    bullets.push('Engagement quality is moderate.');
  } else if (m.engagement_quality < 0.15) {
    concerns.push('Низкое качество вовлечения: реакции слабые относительно просмотров.');
    bullets.push('Low engagement quality may indicate passive audience.');
  }

  // --- Engagement Stability ---
  if (m.engagement_stability > 0.7) {
    strengths.push('Стабильное вовлечение: аудитория реагирует предсказуемо.');
  } else if (m.engagement_stability < 0.3) {
    concerns.push('Нестабильное вовлечение: резкие колебания между постами.');
    bullets.push('High volatility in engagement across posts.');
  }

  // --- Posting Consistency ---
  if (m.posting_consistency > 0.6) {
    strengths.push('Регулярный постинг поддерживает аудиторию в тонусе.');
  } else if (m.posting_consistency < 0.3) {
    concerns.push('Нерегулярный постинг снижает устойчивость рейтинга.');
    bullets.push('Inconsistent posting pattern detected.');
  }

  // --- Reach Efficiency ---
  if (m.reach_efficiency > 0.5) {
    strengths.push('Хороший охват относительно количества подписчиков.');
  } else if (m.reach_efficiency < 0.2) {
    concerns.push('Низкий охват: контент не доходит до аудитории.');
  }

  // --- Follower Growth ---
  if (m.follower_growth !== undefined) {
    if (m.follower_growth > 0.1) {
      bullets.push(`Audience growing (+${(m.follower_growth * 100).toFixed(0)}% in window).`);
      if (m.reach_efficiency > 0.3) {
        strengths.push('Здоровый рост аудитории с хорошим охватом.');
      }
    } else if (m.follower_growth < -0.1) {
      concerns.push('Аудитория сокращается.');
      bullets.push('Follower count declining.');
    }
  }

  // --- Volatility ---
  if (m.volatility > 1.5) {
    concerns.push('Высокая волатильность: результаты постов сильно отличаются.');
  }

  // --- Red Flags ---
  if (score.red_flags.length > 0) {
    bullets.push(`${score.red_flags.length} risk flag(s) detected.`);
    for (const flag of score.red_flags) {
      if (flag.severity >= 2) {
        concerns.push(flagToHumanReadable(flag));
      }
    }
  } else {
    strengths.push('Явных аномалий не обнаружено.');
    bullets.push('No risk flags detected.');
  }

  // --- Risk Level Summary ---
  if (score.risk_level === 'high') {
    bullets.push('Overall risk level: HIGH. Exercise caution.');
  } else if (score.risk_level === 'medium') {
    bullets.push('Overall risk level: MEDIUM. Monitor closely.');
  } else {
    bullets.push('Overall risk level: LOW.');
  }

  // --- Generate Summary ---
  let summary: string;
  if (score.influence_score >= 700 && score.risk_level === 'low') {
    summary = 'Strong, healthy account with high influence and low risk.';
  } else if (score.influence_score >= 500 && score.risk_level !== 'high') {
    summary = 'Solid account with good engagement metrics.';
  } else if (score.risk_level === 'high') {
    summary = 'Account shows concerning patterns. Detailed review recommended.';
  } else if (score.influence_score < 300) {
    summary = 'Limited influence. May be new or inactive account.';
  } else {
    summary = 'Average account with room for improvement.';
  }

  // --- Generate Recommendation ---
  let recommendation: string;
  if (score.risk_level === 'high') {
    recommendation = 'Рекомендуется детальная проверка перед сотрудничеством.';
  } else if (score.risk_level === 'medium') {
    recommendation = 'Можно рассматривать, но следует отслеживать динамику.';
  } else if (score.influence_score >= 600) {
    recommendation = 'Хороший кандидат для сотрудничества.';
  } else {
    recommendation = 'Подходит для небольших кампаний или тестов.';
  }

  return {
    summary,
    bullets: bullets.slice(0, 5), // Max 5 bullets
    strengths: strengths.slice(0, 3),
    concerns: concerns.slice(0, 3),
    recommendation,
  };
}

/**
 * Convert red flag to human-readable text
 */
function flagToHumanReadable(flag: ConnectionsRedFlag): string {
  const typeMap: Record<string, string> = {
    'RATIO_LIKE_HEAVY': 'Подозрительно высокий процент лайков без репостов и комментариев.',
    'RATIO_REPOST_FARM': 'Признаки репост-фермы: много репостов, мало лайков.',
    'VIRAL_SPIKE_DEPENDENCE': 'Зависимость от редких вирусных постов.',
    'GROWTH_SPIKE_LOW_REACH': 'Резкий рост подписчиков при низком охвате — риск накрутки.',
    'LOW_STABILITY': 'Нестабильные показатели вовлечения.',
    'LOW_ACTIVITY': 'Низкая активность постинга.',
  };
  return typeMap[flag.type] || flag.reason;
}

/**
 * Quick explain - just key points
 */
export function quickExplain(score: ConnectionsScoreResult): string[] {
  const explanation = explainScore(score);
  return [explanation.summary, ...explanation.bullets.slice(0, 2)];
}

/**
 * Explain for UI card (minimal)
 */
export function explainForCard(score: ConnectionsScoreResult): {
  status: 'good' | 'moderate' | 'concern';
  oneLiner: string;
} {
  if (score.risk_level === 'high' || score.influence_score < 200) {
    return {
      status: 'concern',
      oneLiner: 'Требуется внимание: обнаружены риски.',
    };
  }
  if (score.influence_score >= 600 && score.risk_level === 'low') {
    return {
      status: 'good',
      oneLiner: 'Сильный аккаунт с хорошими метриками.',
    };
  }
  return {
    status: 'moderate',
    oneLiner: 'Средние показатели, есть потенциал.',
  };
}
