/**
 * Network Weight Policy
 * 
 * Controls how network component contributes to score.
 * Limits based on confidence, drift, pilot step.
 */

export interface NetworkWeightConfig {
  enabled: boolean;
  max_weight: number;          // 0-0.15 (15% max)
  confidence_required: number;  // Min confidence to apply weight
  drift_block_levels: string[];
  pilot_step_limits: Record<string, number>;
}

export interface NetworkWeightDecision {
  apply_weight: boolean;
  weight: number;
  reason?: string;
  violations: string[];
}

const DEFAULT_CONFIG: NetworkWeightConfig = {
  enabled: false,              // Start disabled
  max_weight: 0.15,            // Max 15%
  confidence_required: 0.5,
  drift_block_levels: ['HIGH'],
  pilot_step_limits: {
    'T2.3': 0.05,              // 5% in T2.3
    'T2.4': 0.10,              // 10% in T2.4
    'T3': 0.15,                // 15% in T3
  },
};

let weightConfig: NetworkWeightConfig = { ...DEFAULT_CONFIG };

export function getNetworkWeightConfig(): NetworkWeightConfig {
  return { ...weightConfig };
}

export function updateNetworkWeightConfig(updates: Partial<NetworkWeightConfig>): NetworkWeightConfig {
  weightConfig = {
    ...weightConfig,
    ...updates,
    max_weight: Math.min(0.15, Math.max(0, updates.max_weight || weightConfig.max_weight)),
  };
  return { ...weightConfig };
}

/**
 * Calculate allowed network weight
 */
export function calculateNetworkWeight(context: {
  confidence: number;
  driftLevel: string;
  pilotStep: string;
}): NetworkWeightDecision {
  const config = getNetworkWeightConfig();
  const violations: string[] = [];
  
  if (!config.enabled) {
    return { apply_weight: false, weight: 0, reason: 'Network weight disabled', violations: [] };
  }

  // Check confidence
  if (context.confidence < config.confidence_required) {
    violations.push(`Confidence ${(context.confidence * 100).toFixed(0)}% < required ${(config.confidence_required * 100).toFixed(0)}%`);
  }

  // Check drift
  if (config.drift_block_levels.includes(context.driftLevel)) {
    violations.push(`Drift level ${context.driftLevel} is blocked`);
  }

  // Get pilot step limit
  const stepLimit = config.pilot_step_limits[context.pilotStep] || 0;
  const effectiveWeight = Math.min(config.max_weight, stepLimit);

  if (violations.length > 0) {
    return {
      apply_weight: false,
      weight: 0,
      reason: 'Violations detected',
      violations,
    };
  }

  return {
    apply_weight: true,
    weight: effectiveWeight,
    violations: [],
  };
}

/**
 * Check if network weight should be auto-disabled
 */
export function shouldAutoDisableNetwork(context: {
  driftLevel: string;
  adapterMode: string;
}): { disable: boolean; reason?: string } {
  if (context.driftLevel === 'HIGH') {
    return { disable: true, reason: 'Drift HIGH - auto-disable' };
  }
  if (context.adapterMode === 'OFF') {
    return { disable: true, reason: 'Twitter adapter OFF - auto-disable' };
  }
  return { disable: false };
}
