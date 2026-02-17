/**
 * Micro-Freeze Types - T2.5
 * 
 * Type definitions for the Micro-Freeze Pipeline
 */

// ============================================================
// FREEZE STATUS
// ============================================================

export type FreezeStatus = 'INACTIVE' | 'ACTIVE' | 'PENDING_ACTIVATION';

export type FreezeLevel = 'MICRO_FREEZE' | 'PRODUCTION_FREEZE';

// ============================================================
// LOCKED PARAMETERS
// ============================================================

export interface AlertPipelineLock {
  confidence_gate: number;           // 0.70
  aqm_thresholds_locked: boolean;
  dedup_windows_locked: boolean;
  kill_switch_always_on: boolean;
  no_new_alert_types: boolean;
}

export interface NetworkLock {
  weight_cap: number;                // 0.20
  source: 'co-engagement';
  confidence_cap: number;            // 0.75
  follow_graph_disabled: boolean;
  authority_disabled: boolean;
}

export interface DriftLock {
  thresholds_locked: boolean;
  high_blocks_expansion: boolean;
  auto_rollback_on_high: boolean;
}

export interface Ml2Lock {
  mode_shadow_only: boolean;
  no_active_allowed: boolean;
  disagreements_logged: boolean;
}

// ============================================================
// MICRO-FREEZE CONFIG
// ============================================================

export interface MicroFreezeConfig {
  version: string;
  status: FreezeStatus;
  level: FreezeLevel;
  activated_at: string | null;
  activated_by: string | null;
  
  // Locked parameters
  alert_pipeline: AlertPipelineLock;
  network: NetworkLock;
  drift: DriftLock;
  ml2: Ml2Lock;
  
  // Acceptance criteria
  acceptance_criteria: {
    fp_rate_threshold: number;       // 0.15 (15%)
    drift_must_not_be: string[];     // ['HIGH']
    min_stability_hours: number;     // 48
  };
  
  // Auto-guards
  auto_guards: {
    block_weight_increase: boolean;
    block_gate_weakening: boolean;
    block_drift_bypass: boolean;
    auto_rollback_on_violation: boolean;
  };
  
  // Audit
  last_violation_check: string | null;
  violations_blocked: number;
  rollbacks_triggered: number;
}

// ============================================================
// VIOLATION TYPES
// ============================================================

export type ViolationType = 
  | 'WEIGHT_INCREASE_ATTEMPT'
  | 'GATE_WEAKENING_ATTEMPT'
  | 'DRIFT_BYPASS_ATTEMPT'
  | 'ML2_ACTIVATION_ATTEMPT'
  | 'NEW_ALERT_TYPE_ATTEMPT'
  | 'THRESHOLD_CHANGE_ATTEMPT';

export interface FreezeViolation {
  type: ViolationType;
  attempted_by: string;
  attempted_value: any;
  blocked: boolean;
  timestamp: string;
  details: string;
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

export const DEFAULT_MICRO_FREEZE_CONFIG: MicroFreezeConfig = {
  version: 'T2.5',
  status: 'INACTIVE',
  level: 'MICRO_FREEZE',
  activated_at: null,
  activated_by: null,
  
  alert_pipeline: {
    confidence_gate: 0.70,
    aqm_thresholds_locked: true,
    dedup_windows_locked: true,
    kill_switch_always_on: true,
    no_new_alert_types: true,
  },
  
  network: {
    weight_cap: 0.20,
    source: 'co-engagement',
    confidence_cap: 0.75,
    follow_graph_disabled: true,
    authority_disabled: true,
  },
  
  drift: {
    thresholds_locked: true,
    high_blocks_expansion: true,
    auto_rollback_on_high: true,
  },
  
  ml2: {
    mode_shadow_only: true,
    no_active_allowed: true,
    disagreements_logged: true,
  },
  
  acceptance_criteria: {
    fp_rate_threshold: 0.15,
    drift_must_not_be: ['HIGH'],
    min_stability_hours: 48,
  },
  
  auto_guards: {
    block_weight_increase: true,
    block_gate_weakening: true,
    block_drift_bypass: true,
    auto_rollback_on_violation: true,
  },
  
  last_violation_check: null,
  violations_blocked: 0,
  rollbacks_triggered: 0,
};

console.log('[MicroFreeze] Types module loaded');
