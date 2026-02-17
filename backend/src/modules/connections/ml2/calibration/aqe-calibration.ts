/**
 * ML2 AQE Calibration
 * Phase A2 — AQE Integration
 * 
 * AQE влияет на confidence модели, НЕ на probability.
 * Плохая аудитория = снижаем доверие к предсказанию.
 */

import type { Ml2Features } from '../contracts/ml2.types.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * AQE confidence modifier for ML2 predictions
 * 
 * Rules:
 * - HIGH real audience (>75%): no modifier (1.0)
 * - MIXED audience (55-75%): slight reduction (0.85-0.95)
 * - LOW audience (<55%): significant reduction (0.65-0.85)
 * - No data: slight reduction for uncertainty (0.90)
 * 
 * Modifier is weighted by AQE confidence
 */
export function aqeMl2ConfidenceModifier(features: Ml2Features): {
  modifier: number;
  reason: string;
} {
  const realPct = features.aqe_real_pct_0_1;
  const botPct = features.aqe_bot_pressure_0_1;
  const aqeConf = features.aqe_confidence_0_1 ?? 0.5;

  // No AQE data - small penalty for uncertainty
  if (realPct == null || features.aqe_level === 'UNKNOWN') {
    return { modifier: 0.90, reason: 'AQE_NO_DATA' };
  }

  let baseModifier = 1.0;
  let reason = 'AQE_OK';

  // Real audience based modifier
  if (realPct >= 0.75) {
    baseModifier = 1.0;
    reason = 'AQE_HIGH_QUALITY';
  } else if (realPct >= 0.55) {
    baseModifier = 0.90;
    reason = 'AQE_MIXED';
  } else if (realPct >= 0.40) {
    baseModifier = 0.75;
    reason = 'AQE_LOW_QUALITY';
  } else {
    baseModifier = 0.60;
    reason = 'AQE_VERY_LOW_QUALITY';
  }

  // Additional penalty for high bot pressure
  if (botPct != null && botPct > 0.35) {
    baseModifier *= 0.90;
    reason += '+BOT_PRESSURE';
  }

  // Additional penalty for growth anomaly
  if (features.aqe_anomaly) {
    baseModifier *= 0.85;
    reason += '+ANOMALY';
  }

  // Weight by AQE confidence (low confidence = softer modifier)
  const weightedModifier = baseModifier * aqeConf + 1.0 * (1 - aqeConf);

  return { 
    modifier: clamp01(weightedModifier), 
    reason 
  };
}

/**
 * Apply AQE calibration to ML2 probability
 * 
 * Note: We modify confidence, not raw probability.
 * This is more conservative approach:
 * - prob stays the same (model's prediction)
 * - confidence_modifier tells us how much to trust it
 * - final decision uses: prob * confidence_modifier
 */
export function calibrateMl2WithAqe(
  prob: number,
  features: Ml2Features
): {
  calibrated_prob: number;
  original_prob: number;
  confidence_modifier: number;
  reason: string;
} {
  const { modifier, reason } = aqeMl2ConfidenceModifier(features);
  
  return {
    calibrated_prob: clamp01(prob * modifier),
    original_prob: prob,
    confidence_modifier: modifier,
    reason,
  };
}

/**
 * AQE-aware recommendation adjustment
 * 
 * In ACTIVE_SAFE mode:
 * - If AQE is LOW → can only DOWNRANK or SUPPRESS, never upgrade
 * - This prevents sending alerts from accounts with bad audience
 */
export function enforceAqeSafeGuard(
  recommendation: 'KEEP' | 'DOWNRANK' | 'SUPPRESS_SUGGEST',
  features: Ml2Features
): {
  adjusted: 'KEEP' | 'DOWNRANK' | 'SUPPRESS_SUGGEST';
  forced: boolean;
  reason?: string;
} {
  const realPct = features.aqe_real_pct_0_1;
  const botPct = features.aqe_bot_pressure_0_1;
  
  // Very low audience quality → force downrank at minimum
  if (realPct != null && realPct < 0.40) {
    if (recommendation === 'KEEP') {
      return {
        adjusted: 'DOWNRANK',
        forced: true,
        reason: 'AQE_FORCED_DOWNRANK_LOW_AUDIENCE',
      };
    }
  }
  
  // Very high bot pressure → force downrank at minimum
  if (botPct != null && botPct > 0.50) {
    if (recommendation === 'KEEP') {
      return {
        adjusted: 'DOWNRANK',
        forced: true,
        reason: 'AQE_FORCED_DOWNRANK_BOT_PRESSURE',
      };
    }
  }
  
  return {
    adjusted: recommendation,
    forced: false,
  };
}

console.log('[ML2] AQE Calibration loaded (Phase A2)');
