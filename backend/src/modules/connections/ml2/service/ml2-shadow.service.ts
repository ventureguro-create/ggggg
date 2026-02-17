/**
 * ML2 Shadow Service
 * Phase 5.3 — ML2 Shadow Enable
 * 
 * Main orchestration service for ML2 shadow evaluation
 * KEY PRINCIPLE: ML2 NEVER changes rule decisions in SHADOW mode
 */

import type { Ml2Features, Ml2PredictionResult, Ml2ShadowLogEntry, Ml2Config } from '../contracts/ml2.types.js';
import { buildMl2Features, buildFeatureHash } from '../features/build-ml2-features.ts';
import { ml2ShadowModelV1 } from '../model/ml2-shadow-model.js';
import { getMl2Config } from '../storage/ml2-config.store.js';
import { logShadowPrediction } from '../storage/ml2-shadow-log.store.js';
import { savePrediction } from '../storage/ml2-predictions.store.js';
import { getDriftStatus } from '../../drift/drift.report.service.js';

export interface Ml2EvaluationInput {
  alert_id: string;
  alert_type: string;
  profile?: 'retail' | 'influencer' | 'whale';
  
  // Scores from alert candidate
  early_signal_score?: number;
  confidence_score?: number;
  smart_followers_score?: number;
  authority_score?: number;
  audience_quality_score?: number;
  hops_score?: number;
  fatigue_score?: number;
  pattern_risk_score?: number;
  
  // Rule engine decision (what actually happened)
  rule_decision: 'SEND' | 'SUPPRESS' | 'BLOCK';
}

export interface Ml2EvaluationResult {
  enabled: boolean;
  mode: string;
  prediction?: Ml2PredictionResult;
  would_change: boolean;
  change_type?: 'DOWNRANK' | 'SUPPRESS';
  note: string;
}

/**
 * Evaluate alert with ML2 in shadow mode
 * 
 * THIS IS THE KEY FUNCTION
 * It runs ML2, logs results, but NEVER affects the actual decision
 */
export async function evaluateShadow(input: Ml2EvaluationInput): Promise<Ml2EvaluationResult> {
  // Get config
  const config = await getMl2Config();
  
  // Check if ML2 is enabled
  if (config.mode === 'OFF') {
    return {
      enabled: false,
      mode: 'OFF',
      would_change: false,
      note: 'ML2 is disabled',
    };
  }
  
  // Check if alert type is enabled
  if (!config.enabled_alert_types.includes(input.alert_type)) {
    return {
      enabled: false,
      mode: config.mode,
      would_change: false,
      note: `Alert type ${input.alert_type} not enabled for ML2`,
    };
  }
  
  // Get current drift status
  let driftLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
  try {
    const driftStatus = getDriftStatus();
    driftLevel = driftStatus.level as any;
  } catch (e) {
    // Drift service may not be available
    driftLevel = 'NONE';
  }
  
  // Build features
  const features = buildMl2Features({
    alert_type: input.alert_type,
    profile: input.profile,
    early_signal_score: input.early_signal_score,
    confidence_score: input.confidence_score,
    smart_followers_score: input.smart_followers_score,
    authority_score: input.authority_score,
    audience_quality_score: input.audience_quality_score,
    hops_score: input.hops_score,
    fatigue_score: input.fatigue_score,
    pattern_risk_score: input.pattern_risk_score,
    drift_level: driftLevel,
  });
  
  const featureHash = buildFeatureHash(features);
  
  // Run model
  const prediction = ml2ShadowModelV1(features);
  
  // Determine if ML2 would change the decision
  let wouldChange = false;
  let changeType: 'DOWNRANK' | 'SUPPRESS' | undefined;
  let note = 'ML2 agrees with rule decision';
  
  if (input.rule_decision === 'SEND') {
    // ML2 can only suggest downranking or suppressing SENDs
    if (prediction.prob_useful < config.min_prob_suppress) {
      wouldChange = true;
      changeType = 'SUPPRESS';
      note = `ML2 would SUPPRESS (prob=${prediction.prob_useful.toFixed(2)} < ${config.min_prob_suppress})`;
    } else if (prediction.prob_useful < config.min_prob_downrank) {
      wouldChange = true;
      changeType = 'DOWNRANK';
      note = `ML2 would DOWNRANK (prob=${prediction.prob_useful.toFixed(2)} < ${config.min_prob_downrank})`;
    }
  }
  // ML2 never promotes SUPPRESS → SEND (safety first)
  
  // Log shadow result
  await logShadowPrediction({
    alert_id: input.alert_id,
    rule_decision: input.rule_decision,
    ml2_prob: prediction.prob_useful,
    ml2_label: prediction.label,
    ml2_recommendation: prediction.recommendation,
    would_change: wouldChange,
    change_type: changeType,
    note,
  });
  
  // Save full prediction record
  await savePrediction({
    alert_id: input.alert_id,
    feature_hash: featureHash,
    features,
    rule_decision: input.rule_decision,
    ml2: prediction,
  });
  
  return {
    enabled: true,
    mode: config.mode,
    prediction,
    would_change: wouldChange,
    change_type: changeType,
    note,
  };
}

/**
 * Shadow gate enforcement
 * Ensures ML2 NEVER affects actual decisions in SHADOW mode
 */
export function enforceShadowGate(
  ruleDecision: 'SEND' | 'SUPPRESS' | 'BLOCK',
  ml2Result: Ml2EvaluationResult,
  config: Ml2Config
): 'SEND' | 'SUPPRESS' | 'BLOCK' {
  // In SHADOW mode, always return rule decision unchanged
  if (config.mode === 'SHADOW') {
    return ruleDecision;
  }
  
  // In ACTIVE_SAFE mode, ML2 can only downrank/suppress, never promote
  if (config.mode === 'ACTIVE_SAFE') {
    if (ruleDecision === 'SEND' && ml2Result.change_type === 'SUPPRESS') {
      console.log(`[ML2] ACTIVE_SAFE: Suppressing alert (${ml2Result.note})`);
      return 'SUPPRESS';
    }
    // DOWNRANK doesn't change the decision, just priority
    return ruleDecision;
  }
  
  // OFF or unknown mode
  return ruleDecision;
}

console.log('[ML2] Shadow service loaded (Phase 5.3)');
