/**
 * Alert Quality Explain (Phase 5.1)
 */

import type { AlertContext, AlertQualityExplain } from './alert-quality.types.js';

interface Factor {
  key: string;
  score: number;
  text: string;
}

export function buildAQMExplain(ctx: AlertContext, detProb: number): AlertQualityExplain {
  const positives: Factor[] = [];
  const negatives: Factor[] = [];

  // Positives
  if (ctx.early_signal.score >= 70) {
    positives.push({ key: 'early', score: 2, text: 'Strong early-signal (growth/acceleration)' });
  }
  if (ctx.confidence.score >= 80) {
    positives.push({ key: 'conf', score: 2, text: 'High data confidence' });
  }
  if (ctx.audience.smart_followers_pct >= 25) {
    positives.push({ key: 'smart', score: 2, text: 'High smart followers ratio' });
  }
  if (ctx.network.authority >= 0.6) {
    positives.push({ key: 'auth', score: 1, text: 'High network authority' });
  }
  if (ctx.network.hops_to_elite <= 2) {
    positives.push({ key: 'hops', score: 1, text: 'Close to elite nodes (≤2 hops)' });
  }

  // Negatives
  if (ctx.confidence.score < 65) {
    negatives.push({ key: 'conf_low', score: 3, text: 'Low data confidence (<65%)' });
  }
  if (ctx.audience.purity_score < 55) {
    negatives.push({ key: 'purity', score: 2, text: 'Low audience purity' });
  }
  if (ctx.temporal.alert_count_24h >= 3) {
    negatives.push({ key: 'fatigue', score: 2, text: 'Alert fatigue: too many alerts in 24h' });
  }
  if (ctx.early_signal.score < 40) {
    negatives.push({ key: 'weak_signal', score: 2, text: 'Weak early signal' });
  }
  if (ctx.network.hops_to_elite >= 3 && ctx.network.authority < 0.35) {
    negatives.push({ key: 'weak_net', score: 1, text: 'Weak network: far from elite nodes' });
  }

  positives.sort((a, b) => b.score - a.score);
  negatives.sort((a, b) => b.score - a.score);

  const topPos = positives.slice(0, 3).map(x => x.text);
  const topNeg = negatives.slice(0, 3).map(x => x.text);

  let reason: string;
  if (detProb >= 0.75) {
    reason = 'Strong confirmed signal — recommended to send.';
  } else if (detProb >= 0.55) {
    reason = 'Good signal with some risks — send with caution.';
  } else if (detProb >= 0.40) {
    reason = 'Questionable signal — low priority recommended.';
  } else {
    reason = 'Likely noise — suppression recommended.';
  }

  return {
    top_positive_factors: topPos,
    top_negative_factors: topNeg,
    reason,
  };
}
