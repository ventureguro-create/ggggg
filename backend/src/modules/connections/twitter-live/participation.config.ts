/**
 * Live Participation Config (Phase 4.3)
 * 
 * Controls how live Twitter data participates in Connections calculations.
 * Key principle: BLEND, not REPLACE.
 * 
 * Formula: blended_value = mock_value * (1 - w) + live_value * w
 * Where w = weight / 100 (0-1)
 */

/**
 * Component participation settings
 */
export interface ComponentParticipation {
  enabled: boolean;
  weight: number;  // 0-100%
  effective_weight?: number;  // After guard clamping
  last_changed?: Date;
  changed_by?: string;
}

/**
 * Guard thresholds for safe enable
 */
export interface GuardThresholds {
  min_confidence: number;      // 0-100, default 65
  max_delta: number;           // 0-1, default 0.25 (25%)
  max_spike: number;           // ratio, default 2.0 (200%)
  freshness_days: number;      // default 14
  max_safe_weight: number;     // clamp weight if degraded, default 30
}

/**
 * Full participation config
 */
export interface LiveParticipationConfig {
  enabled: boolean;
  mode: 'off' | 'preview' | 'gradual' | 'full';
  
  // Component weights
  components: {
    followers: ComponentParticipation;
    engagement: ComponentParticipation;
    graph_edges: ComponentParticipation;
    audience_quality: ComponentParticipation;
    authority: ComponentParticipation;
  };
  
  // Safety guards
  guards: GuardThresholds;
  
  // Pilot accounts (for gradual rollout)
  pilot_accounts: string[];
  
  // Auto-rollback settings
  auto_rollback: {
    enabled: boolean;
    trigger_on_spike: boolean;
    trigger_on_confidence_drop: boolean;
    cooldown_minutes: number;
  };
  
  // Timestamps
  last_updated?: Date;
  updated_by?: string;
}

/**
 * Default config - ALL OFF, SAFE
 */
const defaultComponent: ComponentParticipation = {
  enabled: false,
  weight: 0,
};

let participationConfig: LiveParticipationConfig = {
  enabled: false,
  mode: 'off',
  
  components: {
    followers: { ...defaultComponent },
    engagement: { ...defaultComponent },
    graph_edges: { ...defaultComponent },
    audience_quality: { ...defaultComponent },
    authority: { ...defaultComponent },
  },
  
  guards: {
    min_confidence: 65,
    max_delta: 0.25,
    max_spike: 2.0,
    freshness_days: 14,
    max_safe_weight: 30,
  },
  
  pilot_accounts: [],
  
  auto_rollback: {
    enabled: true,
    trigger_on_spike: true,
    trigger_on_confidence_drop: true,
    cooldown_minutes: 30,
  },
};

/**
 * Get current participation config
 */
export function getParticipationConfig(): LiveParticipationConfig {
  return JSON.parse(JSON.stringify(participationConfig));
}

/**
 * Update participation config (partial)
 */
export function updateParticipationConfig(
  updates: Partial<LiveParticipationConfig>,
  updatedBy?: string
): LiveParticipationConfig {
  participationConfig = {
    ...participationConfig,
    ...updates,
    last_updated: new Date(),
    updated_by: updatedBy,
  };
  
  // Update mode based on components
  const anyEnabled = Object.values(participationConfig.components).some(c => c.enabled);
  if (!anyEnabled) {
    participationConfig.mode = 'off';
    participationConfig.enabled = false;
  } else if (participationConfig.pilot_accounts.length > 0) {
    participationConfig.mode = 'gradual';
    participationConfig.enabled = true;
  } else {
    participationConfig.mode = 'preview';
    participationConfig.enabled = true;
  }
  
  console.log(`[LiveParticipation] Config updated by ${updatedBy || 'system'}:`, participationConfig.mode);
  return getParticipationConfig();
}

/**
 * Update single component
 */
export function updateComponentParticipation(
  component: keyof LiveParticipationConfig['components'],
  settings: Partial<ComponentParticipation>,
  updatedBy?: string
): ComponentParticipation {
  participationConfig.components[component] = {
    ...participationConfig.components[component],
    ...settings,
    last_changed: new Date(),
    changed_by: updatedBy,
  };
  
  participationConfig.last_updated = new Date();
  participationConfig.updated_by = updatedBy;
  
  // Update mode
  const anyEnabled = Object.values(participationConfig.components).some(c => c.enabled);
  participationConfig.enabled = anyEnabled;
  
  return participationConfig.components[component];
}

/**
 * Get effective weight for component (after guard clamping)
 */
export function getEffectiveWeight(
  component: keyof LiveParticipationConfig['components']
): number {
  const comp = participationConfig.components[component];
  if (!comp.enabled) return 0;
  return comp.effective_weight ?? comp.weight;
}

/**
 * Rollback all components to OFF
 */
export function rollbackAll(reason: string, triggeredBy?: string): void {
  const components = Object.keys(participationConfig.components) as Array<keyof LiveParticipationConfig['components']>;
  
  for (const comp of components) {
    participationConfig.components[comp] = {
      enabled: false,
      weight: 0,
      effective_weight: 0,
      last_changed: new Date(),
      changed_by: `rollback:${reason}`,
    };
  }
  
  participationConfig.enabled = false;
  participationConfig.mode = 'off';
  participationConfig.last_updated = new Date();
  participationConfig.updated_by = triggeredBy || 'auto-rollback';
  
  console.log(`[LiveParticipation] ROLLBACK ALL: ${reason}`);
}

/**
 * Rollback single component
 */
export function rollbackComponent(
  component: keyof LiveParticipationConfig['components'],
  reason: string
): void {
  participationConfig.components[component] = {
    enabled: false,
    weight: 0,
    effective_weight: 0,
    last_changed: new Date(),
    changed_by: `rollback:${reason}`,
  };
  
  // Check if any still enabled
  const anyEnabled = Object.values(participationConfig.components).some(c => c.enabled);
  participationConfig.enabled = anyEnabled;
  if (!anyEnabled) {
    participationConfig.mode = 'off';
  }
  
  console.log(`[LiveParticipation] ROLLBACK ${component}: ${reason}`);
}
