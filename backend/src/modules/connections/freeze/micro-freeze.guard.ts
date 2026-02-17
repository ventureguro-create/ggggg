/**
 * Micro-Freeze Guard Service - T2.5
 * 
 * Enforces freeze constraints automatically.
 * Blocks any attempt to violate locked parameters.
 */

import type { ViolationType } from './micro-freeze.types.js';
import { 
  getMicroFreezeConfig, 
  isMicroFreezeActive as _isMicroFreezeActive,
  logViolation,
  incrementRollbacksTriggered,
} from './micro-freeze.store.js';
import { getExpansionConfig, rollbackToBaseline } from '../network/network-expansion.config.js';
import { getMl2Mode } from '../ml2/storage/ml2-config.store.js';

// Re-export for convenience
export { isMicroFreezeActive } from './micro-freeze.store.js';

// ============================================================
// GUARD RESULT
// ============================================================

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  violation_logged?: boolean;
}

// ============================================================
// NETWORK WEIGHT GUARD
// ============================================================

/**
 * Guard against network weight increase above cap
 */
export async function guardNetworkWeightChange(
  newWeight: number,
  attemptedBy: string = 'UNKNOWN'
): Promise<GuardResult> {
  const isActive = await _isMicroFreezeActive();
  
  if (!isActive) {
    return { allowed: true };
  }
  
  const config = await getMicroFreezeConfig();
  const currentWeight = getExpansionConfig().network_weight_cap;
  
  // Block if trying to increase above cap
  if (newWeight > config.network.weight_cap) {
    await logViolation({
      type: 'WEIGHT_INCREASE_ATTEMPT',
      attempted_by: attemptedBy,
      attempted_value: { requested: newWeight, cap: config.network.weight_cap },
      blocked: true,
      details: `Attempted to set network weight to ${newWeight}, but cap is ${config.network.weight_cap}`,
    });
    
    return {
      allowed: false,
      reason: `🧊 Micro-Freeze ACTIVE: Network weight cap is ${config.network.weight_cap * 100}%`,
      violation_logged: true,
    };
  }
  
  return { allowed: true };
}

// ============================================================
// CONFIDENCE GATE GUARD
// ============================================================

/**
 * Guard against weakening confidence gate
 */
export async function guardConfidenceGateChange(
  newGate: number,
  attemptedBy: string = 'UNKNOWN'
): Promise<GuardResult> {
  const isActive = await _isMicroFreezeActive();
  
  if (!isActive) {
    return { allowed: true };
  }
  
  const config = await getMicroFreezeConfig();
  
  // Block if trying to lower below locked value
  if (newGate < config.alert_pipeline.confidence_gate) {
    await logViolation({
      type: 'GATE_WEAKENING_ATTEMPT',
      attempted_by: attemptedBy,
      attempted_value: { requested: newGate, locked: config.alert_pipeline.confidence_gate },
      blocked: true,
      details: `Attempted to lower confidence gate to ${newGate}, but locked at ${config.alert_pipeline.confidence_gate}`,
    });
    
    return {
      allowed: false,
      reason: `🧊 Micro-Freeze ACTIVE: Confidence gate locked at ${config.alert_pipeline.confidence_gate * 100}%`,
      violation_logged: true,
    };
  }
  
  return { allowed: true };
}

// ============================================================
// ML2 MODE GUARD
// ============================================================

/**
 * Guard against ML2 activation
 */
export async function guardMl2ModeChange(
  newMode: string,
  attemptedBy: string = 'UNKNOWN'
): Promise<GuardResult> {
  const isActive = await _isMicroFreezeActive();
  
  if (!isActive) {
    return { allowed: true };
  }
  
  const config = await getMicroFreezeConfig();
  
  // Block if trying to activate ML2
  if (config.ml2.no_active_allowed && newMode === 'ACTIVE_SAFE') {
    await logViolation({
      type: 'ML2_ACTIVATION_ATTEMPT',
      attempted_by: attemptedBy,
      attempted_value: { requested: newMode },
      blocked: true,
      details: `Attempted to set ML2 mode to ${newMode}, but ACTIVE modes are blocked during Micro-Freeze`,
    });
    
    return {
      allowed: false,
      reason: '🧊 Micro-Freeze ACTIVE: ML2 must remain in SHADOW mode',
      violation_logged: true,
    };
  }
  
  return { allowed: true };
}

// ============================================================
// DRIFT LEVEL GUARD
// ============================================================

/**
 * Check if current drift level requires action
 */
export async function checkDriftGuard(
  currentDriftLevel: string
): Promise<{
  expansion_blocked: boolean;
  rollback_required: boolean;
  reason?: string;
}> {
  const isActive = await _isMicroFreezeActive();
  
  if (!isActive) {
    return { expansion_blocked: false, rollback_required: false };
  }
  
  const config = await getMicroFreezeConfig();
  
  if (config.drift.high_blocks_expansion && currentDriftLevel === 'HIGH') {
    const shouldRollback = config.drift.auto_rollback_on_high;
    
    if (shouldRollback) {
      // Trigger auto-rollback
      rollbackToBaseline();
      await incrementRollbacksTriggered();
      
      await logViolation({
        type: 'DRIFT_BYPASS_ATTEMPT',
        attempted_by: 'DRIFT_MONITOR',
        attempted_value: { drift_level: currentDriftLevel },
        blocked: true,
        details: `High drift detected. Auto-rollback triggered.`,
      });
      
      return {
        expansion_blocked: true,
        rollback_required: true,
        reason: '🧊 Micro-Freeze: HIGH drift detected. Auto-rollback triggered.',
      };
    }
    
    return {
      expansion_blocked: true,
      rollback_required: false,
      reason: '🧊 Micro-Freeze: HIGH drift detected. Expansion blocked.',
    };
  }
  
  return { expansion_blocked: false, rollback_required: false };
}

// ============================================================
// ALERT TYPE GUARD
// ============================================================

/**
 * Guard against adding new alert types
 */
export async function guardNewAlertType(
  alertType: string,
  attemptedBy: string = 'UNKNOWN'
): Promise<GuardResult> {
  const isActive = await _isMicroFreezeActive();
  
  if (!isActive) {
    return { allowed: true };
  }
  
  const config = await getMicroFreezeConfig();
  
  // Known types that are allowed
  const ALLOWED_TYPES = ['EARLY_BREAKOUT', 'STRONG_ACCELERATION', 'TREND_REVERSAL'];
  
  if (config.alert_pipeline.no_new_alert_types && !ALLOWED_TYPES.includes(alertType)) {
    await logViolation({
      type: 'NEW_ALERT_TYPE_ATTEMPT',
      attempted_by: attemptedBy,
      attempted_value: { requested: alertType },
      blocked: true,
      details: `Attempted to add new alert type ${alertType}, but no new types allowed during Micro-Freeze`,
    });
    
    return {
      allowed: false,
      reason: `🧊 Micro-Freeze ACTIVE: No new alert types allowed`,
      violation_logged: true,
    };
  }
  
  return { allowed: true };
}

// ============================================================
// THRESHOLD CHANGE GUARD
// ============================================================

/**
 * Guard against changing AQM/drift thresholds
 */
export async function guardThresholdChange(
  thresholdType: 'aqm' | 'drift' | 'dedup',
  attemptedBy: string = 'UNKNOWN'
): Promise<GuardResult> {
  const isActive = await _isMicroFreezeActive();
  
  if (!isActive) {
    return { allowed: true };
  }
  
  const config = await getMicroFreezeConfig();
  
  let blocked = false;
  
  if (thresholdType === 'aqm' && config.alert_pipeline.aqm_thresholds_locked) {
    blocked = true;
  }
  
  if (thresholdType === 'drift' && config.drift.thresholds_locked) {
    blocked = true;
  }
  
  if (thresholdType === 'dedup' && config.alert_pipeline.dedup_windows_locked) {
    blocked = true;
  }
  
  if (blocked) {
    await logViolation({
      type: 'THRESHOLD_CHANGE_ATTEMPT',
      attempted_by: attemptedBy,
      attempted_value: { threshold_type: thresholdType },
      blocked: true,
      details: `Attempted to change ${thresholdType} thresholds during Micro-Freeze`,
    });
    
    return {
      allowed: false,
      reason: `🧊 Micro-Freeze ACTIVE: ${thresholdType} thresholds are locked`,
      violation_logged: true,
    };
  }
  
  return { allowed: true };
}

// ============================================================
// FULL STATUS CHECK
// ============================================================

/**
 * Get comprehensive freeze status for admin panel
 */
export async function getFreezeStatus(): Promise<{
  active: boolean;
  config: any;
  current_state: {
    network_weight: number;
    confidence_gate: number;
    ml2_mode: string;
    drift_blocking: boolean;
  };
  violations_24h: number;
  rollbacks_24h: number;
}> {
  const config = await getMicroFreezeConfig();
  const expansionConfig = getExpansionConfig();
  
  let ml2Mode = 'SHADOW';
  try {
    ml2Mode = await getMl2Mode();
  } catch {
    // Ignore if ML2 not initialized
  }
  
  // Get 24h violations
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { getViolationStats } = await import('./micro-freeze.store.js');
  const stats = await getViolationStats(since24h);
  
  return {
    active: config.status === 'ACTIVE',
    config,
    current_state: {
      network_weight: expansionConfig.network_weight_cap,
      confidence_gate: config.alert_pipeline.confidence_gate,
      ml2_mode: ml2Mode,
      drift_blocking: config.drift.high_blocks_expansion,
    },
    violations_24h: stats.blocked,
    rollbacks_24h: config.rollbacks_triggered,
  };
}

console.log('[MicroFreeze] Guard service loaded');
