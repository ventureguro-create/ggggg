/**
 * Alert Policy Engine
 * 
 * Unified decision engine for all alert sources.
 * Gates: confidence, AQM, ML2 shadow, drift.
 * Decisions: SEND | SUPPRESS | BLOCK
 */

import { Db } from 'mongodb';

export type AlertSource = 'mock' | 'twitter' | 'core';
export type AlertDecision = 'SEND' | 'SUPPRESS' | 'BLOCK';

export type SuppressionReason = 
  | 'CONFIDENCE_LOW'
  | 'AQM_NOISE'
  | 'ML2_DISAGREE'
  | 'DRIFT_HIGH'
  | 'PILOT_DISABLED'
  | 'ACCOUNT_NOT_PILOT'
  | 'DEDUP_COOLDOWN'
  | 'RATE_LIMIT'
  | 'KILL_SWITCH'
  | 'ADAPTER_OFF';

export interface AlertCandidate {
  id: string;
  account_id: string;
  signal_type: string;
  source: AlertSource;
  confidence: number;
  context: {
    diff_delta?: number;
    pattern?: string;
    ml2_score?: number;
    aqm_level?: string;
  };
  created_at: Date;
}

export interface PolicyDecision {
  decision: AlertDecision;
  reason?: SuppressionReason;
  gates_passed: {
    confidence: boolean;
    aqm: boolean;
    ml2: boolean;
    drift: boolean;
    pilot: boolean;
    dedup: boolean;
    rate_limit: boolean;
    kill_switch: boolean;
  };
  metadata: {
    confidence_threshold: number;
    actual_confidence: number;
    source: AlertSource;
  };
}

export interface PolicyConfig {
  confidence_threshold: number;
  aqm_block_levels: string[];
  ml2_min_agreement: number;
  drift_block_levels: string[];
  pilot_only: boolean;
}

const DEFAULT_CONFIG: PolicyConfig = {
  confidence_threshold: 0.7,
  aqm_block_levels: ['NOISE', 'SPAM'],
  ml2_min_agreement: 0.6,
  drift_block_levels: ['HIGH'],
  pilot_only: true,
};

let policyConfig: PolicyConfig = { ...DEFAULT_CONFIG };

export function getPolicyConfig(): PolicyConfig {
  return { ...policyConfig };
}

export function updatePolicyConfig(updates: Partial<PolicyConfig>): PolicyConfig {
  policyConfig = { ...policyConfig, ...updates };
  return { ...policyConfig };
}

/**
 * Evaluate alert candidate against all gates
 */
export async function evaluateAlert(
  candidate: AlertCandidate,
  context: {
    isPilotAccount: boolean;
    isDuplicate: boolean;
    isRateLimited: boolean;
    isKillSwitchOn: boolean;
    isAdapterEnabled: boolean;
    driftLevel: string;
  }
): Promise<PolicyDecision> {
  const config = getPolicyConfig();
  
  const gates = {
    confidence: candidate.confidence >= config.confidence_threshold,
    aqm: !config.aqm_block_levels.includes(candidate.context.aqm_level || ''),
    ml2: (candidate.context.ml2_score || 1) >= config.ml2_min_agreement,
    drift: !config.drift_block_levels.includes(context.driftLevel),
    pilot: !config.pilot_only || context.isPilotAccount,
    dedup: !context.isDuplicate,
    rate_limit: !context.isRateLimited,
    kill_switch: !context.isKillSwitchOn,
  };

  // Determine decision and reason
  let decision: AlertDecision = 'SEND';
  let reason: SuppressionReason | undefined;

  // Twitter-specific checks
  if (candidate.source === 'twitter') {
    if (!context.isAdapterEnabled) {
      decision = 'BLOCK';
      reason = 'ADAPTER_OFF';
    } else if (context.isKillSwitchOn) {
      decision = 'BLOCK';
      reason = 'KILL_SWITCH';
    }
  }

  // Universal gates
  if (decision === 'SEND') {
    if (!gates.kill_switch) {
      decision = 'BLOCK';
      reason = 'KILL_SWITCH';
    } else if (!gates.pilot) {
      decision = 'SUPPRESS';
      reason = 'ACCOUNT_NOT_PILOT';
    } else if (!gates.confidence) {
      decision = 'SUPPRESS';
      reason = 'CONFIDENCE_LOW';
    } else if (!gates.aqm) {
      decision = 'SUPPRESS';
      reason = 'AQM_NOISE';
    } else if (!gates.ml2) {
      decision = 'SUPPRESS';
      reason = 'ML2_DISAGREE';
    } else if (!gates.drift) {
      decision = 'BLOCK';
      reason = 'DRIFT_HIGH';
    } else if (!gates.dedup) {
      decision = 'SUPPRESS';
      reason = 'DEDUP_COOLDOWN';
    } else if (!gates.rate_limit) {
      decision = 'SUPPRESS';
      reason = 'RATE_LIMIT';
    }
  }

  return {
    decision,
    reason,
    gates_passed: gates,
    metadata: {
      confidence_threshold: config.confidence_threshold,
      actual_confidence: candidate.confidence,
      source: candidate.source,
    },
  };
}

/**
 * Quick check if twitter alerts are allowed
 */
export function isTwitterAlertsAllowed(
  adapterEnabled: boolean,
  killSwitchOn: boolean,
  driftLevel: string
): { allowed: boolean; reason?: string } {
  if (!adapterEnabled) return { allowed: false, reason: 'Twitter adapter disabled' };
  if (killSwitchOn) return { allowed: false, reason: 'Kill switch active' };
  if (['HIGH'].includes(driftLevel)) return { allowed: false, reason: 'Drift level too high' };
  return { allowed: true };
}
