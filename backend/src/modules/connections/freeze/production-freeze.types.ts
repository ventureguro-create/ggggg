/**
 * Production Freeze v1 - Types
 * 
 * Official Production Freeze for Connections Module
 * This is the FINAL freeze before scaling
 */

// ============================================================
// FREEZE LEVELS
// ============================================================

export type ProductionFreezeStatus = 'INACTIVE' | 'ACTIVE' | 'LOCKED';

export interface FrozenComponent {
  name: string;
  version: string;
  frozen_at: string;
  can_modify: boolean;
  locked_params: string[];
}

// ============================================================
// PRODUCTION FREEZE CONFIG
// ============================================================

export interface ProductionFreezeConfig {
  version: string;                    // 'v1'
  status: ProductionFreezeStatus;
  level: 'PRODUCTION';
  activated_at: string | null;
  activated_by: string | null;
  
  // Frozen components
  frozen_components: {
    twitter_score_v1: FrozenComponent;
    confidence_gates: FrozenComponent;
    aqm_patterns: FrozenComponent;
    drift_v1: FrozenComponent;
    ml2_shadow: FrozenComponent;
    network_weight: FrozenComponent;
    alerts_policy: FrozenComponent;
  };
  
  // What's allowed during freeze
  allowed_actions: {
    add_accounts: boolean;
    enable_alerts: boolean;
    collect_feedback: boolean;
    monitor_fp_fn: boolean;
    update_ui: boolean;
  };
  
  // What's NOT allowed
  blocked_actions: {
    change_weights: boolean;
    change_decision_logic: boolean;
    tune_for_market: boolean;
    add_new_signals: boolean;
    modify_formulas: boolean;
  };
  
  // Statistics collection
  stats_collection: {
    enabled: boolean;
    started_at: string | null;
    fp_count: number;
    fn_count: number;
    total_alerts: number;
    useful_signals: number;
    feedback_entries: number;
  };
  
  // Network v2 preparation (read-only)
  network_v2_ready: boolean;
  network_v2_status: 'NOT_STARTED' | 'PREPARING' | 'SHADOW' | 'ACTIVE';
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

export const DEFAULT_PRODUCTION_FREEZE_CONFIG: ProductionFreezeConfig = {
  version: 'v1',
  status: 'INACTIVE',
  level: 'PRODUCTION',
  activated_at: null,
  activated_by: null,
  
  frozen_components: {
    twitter_score_v1: {
      name: 'Twitter Score v1',
      version: '1.0',
      frozen_at: '',
      can_modify: false,
      locked_params: ['weights', 'formula', 'thresholds'],
    },
    confidence_gates: {
      name: 'Confidence Gates',
      version: '1.0',
      frozen_at: '',
      can_modify: false,
      locked_params: ['min_confidence', 'gate_logic'],
    },
    aqm_patterns: {
      name: 'AQM + Patterns',
      version: '1.0',
      frozen_at: '',
      can_modify: false,
      locked_params: ['pattern_weights', 'quality_thresholds'],
    },
    drift_v1: {
      name: 'Drift v1',
      version: '1.0',
      frozen_at: '',
      can_modify: false,
      locked_params: ['drift_thresholds', 'rollback_rules'],
    },
    ml2_shadow: {
      name: 'ML2 Shadow',
      version: '1.0',
      frozen_at: '',
      can_modify: false,
      locked_params: ['mode=SHADOW', 'no_decision_impact'],
    },
    network_weight: {
      name: 'Network Weight',
      version: '1.0',
      frozen_at: '',
      can_modify: false,
      locked_params: ['weight_cap=20%', 'source=co-engagement'],
    },
    alerts_policy: {
      name: 'Alerts Policy',
      version: '1.0',
      frozen_at: '',
      can_modify: false,
      locked_params: ['dedup', 'cooldown', 'kill_switch'],
    },
  },
  
  allowed_actions: {
    add_accounts: true,
    enable_alerts: true,
    collect_feedback: true,
    monitor_fp_fn: true,
    update_ui: true,
  },
  
  blocked_actions: {
    change_weights: true,
    change_decision_logic: true,
    tune_for_market: true,
    add_new_signals: true,
    modify_formulas: true,
  },
  
  stats_collection: {
    enabled: false,
    started_at: null,
    fp_count: 0,
    fn_count: 0,
    total_alerts: 0,
    useful_signals: 0,
    feedback_entries: 0,
  },
  
  network_v2_ready: false,
  network_v2_status: 'NOT_STARTED',
};

console.log('[ProductionFreeze] Types module loaded');
