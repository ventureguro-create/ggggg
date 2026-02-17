/**
 * ML2 Features Builder
 * Phase 5.3 — ML2 Shadow Enable
 * Phase A2 — AQE Integration
 * 
 * Builds feature vector for ML2 model from alert data
 */

import type { Ml2Features } from '../contracts/ml2.types.js';
import crypto from 'crypto';

/**
 * Clamp value to 0-1 range
 */
function clamp01(x?: number | null): number {
  if (x === null || x === undefined || isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Derive AQE level from real audience percentage
 */
function deriveAqeLevel(realPct?: number): 'HIGH' | 'MIXED' | 'LOW' | 'UNKNOWN' {
  if (realPct == null) return 'UNKNOWN';
  if (realPct >= 0.75) return 'HIGH';
  if (realPct >= 0.55) return 'MIXED';
  return 'LOW';
}

/**
 * Build ML2 features from alert data
 * All values normalized to 0-1 for model consistency
 */
export function buildMl2Features(input: {
  alert_type: string;
  profile?: 'retail' | 'influencer' | 'whale';
  
  // Raw scores (will be normalized)
  early_signal_score?: number;
  confidence_score?: number;
  smart_followers_score?: number;
  authority_score?: number;
  audience_quality_score?: number;
  hops_score?: number;
  fatigue_score?: number;
  pattern_risk_score?: number;
  
  // Drift from environment
  drift_level?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  
  // NEW: AQE data (Phase A2)
  aqe_real_pct?: number;
  aqe_bot_pressure?: number;
  aqe_confidence?: number;
  aqe_anomaly?: boolean;
}): Ml2Features {
  const aqeLevel = deriveAqeLevel(input.aqe_real_pct);
  
  return {
    alert_type: input.alert_type || 'UNKNOWN',
    profile: input.profile || 'retail',
    
    early_signal_0_1: clamp01(input.early_signal_score),
    confidence_0_1: clamp01(input.confidence_score),
    smart_followers_0_1: clamp01(input.smart_followers_score),
    authority_0_1: clamp01(input.authority_score),
    audience_quality_0_1: clamp01(input.audience_quality_score),
    hops_0_1: clamp01(input.hops_score),
    fatigue_0_1: clamp01(input.fatigue_score),
    pattern_risk_0_1: clamp01(input.pattern_risk_score),
    
    drift_level: input.drift_level || 'NONE',
    
    // NEW: AQE extended features
    aqe_real_pct_0_1: clamp01(input.aqe_real_pct),
    aqe_bot_pressure_0_1: clamp01(input.aqe_bot_pressure),
    aqe_confidence_0_1: clamp01(input.aqe_confidence),
    aqe_level: aqeLevel,
    aqe_anomaly: input.aqe_anomaly ?? false,
  };
}

/**
 * Build feature hash for dataset linking
 * Same features → same hash → can link feedback to predictions
 */
export function buildFeatureHash(features: Ml2Features): string {
  const normalized = {
    alert_type: features.alert_type,
    profile: features.profile,
    early: Math.round(features.early_signal_0_1 * 100),
    conf: Math.round(features.confidence_0_1 * 100),
    smart: Math.round(features.smart_followers_0_1 * 100),
    auth: Math.round(features.authority_0_1 * 100),
    aq: Math.round(features.audience_quality_0_1 * 100),
    hops: Math.round(features.hops_0_1 * 100),
    fatigue: Math.round(features.fatigue_0_1 * 100),
    risk: Math.round(features.pattern_risk_0_1 * 100),
    drift: features.drift_level,
    // NEW: Include AQE in hash
    aqe_real: Math.round((features.aqe_real_pct_0_1 ?? 0) * 100),
    aqe_bot: Math.round((features.aqe_bot_pressure_0_1 ?? 0) * 100),
    aqe_level: features.aqe_level,
  };
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .slice(0, 16);  // 16 chars is enough for uniqueness
}

/**
 * Extract AQE tags from features for logging
 */
export function extractAqeTags(features: Ml2Features): string[] {
  const tags: string[] = [];
  
  const realPct = features.aqe_real_pct_0_1 ?? 1;
  const botPct = features.aqe_bot_pressure_0_1 ?? 0;
  
  if (realPct < 0.55) {
    tags.push('AQE_LOW_AUDIENCE');
  } else if (realPct < 0.75) {
    tags.push('AQE_MIXED_AUDIENCE');
  }
  
  if (botPct > 0.35) {
    tags.push('AQE_HIGH_BOT_PRESSURE');
  } else if (botPct > 0.20) {
    tags.push('AQE_MODERATE_BOT_PRESSURE');
  }
  
  if (features.aqe_anomaly) {
    tags.push('AQE_GROWTH_ANOMALY');
  }
  
  if (features.aqe_level === 'UNKNOWN') {
    tags.push('AQE_NO_DATA');
  }
  
  return tags;
}

console.log('[ML2] Features builder loaded (Phase A2 — AQE Integration)');
