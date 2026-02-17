/**
 * Alert Quality Model Engine (Phase 5.1)
 * 
 * Deterministic scoring with ML-ready shadow mode.
 * Does NOT modify Twitter Score — only filters alerts.
 */

import type { AlertContext, AlertQualityResult, AQMLabel, AQMRecommendation } from './alert-quality.types.js';
import { type AQMConfig, DEFAULT_AQM_CONFIG } from './alert-quality.config.js';
import { buildAQMExplain } from './alert-quality.explain.js';

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function n100(x: number): number { return clamp01(x / 100); }
function n1k(x: number): number { return clamp01(x / 1000); }

/**
 * Compute deterministic AQM score
 */
export function computeDeterministicAQM(ctx: AlertContext, config: AQMConfig = DEFAULT_AQM_CONFIG): number {
  const w = config.weights;

  const early = n100(ctx.early_signal.score);
  const conf = n100(ctx.confidence.score);
  const smart = n100(ctx.audience.smart_followers_pct);
  const auth = clamp01(ctx.network.authority);
  const fatigue = clamp01(ctx.temporal.alert_count_24h / 5);

  const raw =
    w.early_signal * early +
    w.confidence * conf +
    w.smart_followers * smart +
    w.authority * auth -
    w.alert_fatigue * fatigue;

  const scoreBoost = 0.05 * n1k(ctx.scores.twitter_score);

  return clamp01(raw + scoreBoost);
}

/**
 * Get label and recommendation from probability
 */
export function labelFromProb(p: number, config: AQMConfig): { label: AQMLabel; rec: AQMRecommendation } {
  const t = config.thresholds;

  if (p >= t.high) return { label: 'HIGH', rec: 'SEND' };
  if (p >= t.medium) return { label: 'MEDIUM', rec: 'SEND' };
  if (p >= t.low) return { label: 'LOW', rec: config.low_priority_label ? 'SEND_LOW_PRIORITY' : 'SEND' };
  return { label: 'NOISE', rec: 'SUPPRESS' };
}

/**
 * Main evaluation function
 */
export function evaluateAlertQuality(
  ctx: AlertContext,
  cfg: AQMConfig = DEFAULT_AQM_CONFIG,
  patternRiskScore?: number
): AlertQualityResult {
  const det = computeDeterministicAQM(ctx, cfg);

  // Confidence gate
  if (cfg.enabled && ctx.confidence.score < cfg.min_confidence_score) {
    const explain = buildAQMExplain(ctx, det);
    return {
      probability: 0,
      label: 'NOISE',
      recommendation: 'SUPPRESS',
      explain: {
        ...explain,
        reason: 'Alert blocked: confidence below minimum threshold.',
      },
      components: { deterministic: det },
      gates: { confidence_blocked: true },
    };
  }

  // Apply pattern risk penalty
  let adjustedProb = det;
  if (patternRiskScore && patternRiskScore > 50) {
    const penalty = (patternRiskScore - 50) / 100; // 0-0.5 penalty
    adjustedProb = clamp01(det - penalty * 0.3);
  }

  // ML shadow placeholder
  let finalProb = adjustedProb;
  let mlProb: number | undefined;

  if (cfg.shadow_ml_enabled) {
    mlProb = adjustedProb; // v1: identical
    finalProb = clamp01(0.7 * adjustedProb + 0.3 * mlProb);
  }

  const { label, rec } = labelFromProb(finalProb, cfg);
  const explain = buildAQMExplain(ctx, finalProb);

  return {
    probability: finalProb,
    label,
    recommendation: cfg.enabled ? rec : 'SEND',
    explain,
    components: { deterministic: det, ml: mlProb },
  };
}

console.log('[AQM] Alert Quality Model Engine loaded (Phase 5.1)');
