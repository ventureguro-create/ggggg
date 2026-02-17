/**
 * Network Expansion Config - T2.4
 * 
 * Controlled expansion: 15% → 20%
 * Only for pilot accounts, co-engagement only.
 */

export interface ExpansionConfig {
  version: string;
  network_weight_cap: number;        // 0.20 (was 0.15)
  network_weight_pilot_only: boolean;
  confidence_required: number;
  divergence_max: number;            // Max mock vs live divergence
  drift_block_levels: string[];
  auto_rollback_enabled: boolean;
  rollback_threshold_fp_rate: number;
}

export const T24_EXPANSION_CONFIG: ExpansionConfig = {
  version: 'T2.4',
  network_weight_cap: 0.20,          // Expanded from 0.15
  network_weight_pilot_only: true,
  confidence_required: 0.70,
  divergence_max: 0.30,              // 30% max divergence
  drift_block_levels: ['HIGH'],
  auto_rollback_enabled: true,
  rollback_threshold_fp_rate: 0.15,  // 15% FP triggers rollback
};

let currentConfig: ExpansionConfig = { ...T24_EXPANSION_CONFIG };

export function getExpansionConfig(): ExpansionConfig {
  return { ...currentConfig };
}

export function updateExpansionConfig(updates: Partial<ExpansionConfig>): ExpansionConfig {
  currentConfig = {
    ...currentConfig,
    ...updates,
    network_weight_cap: Math.min(0.20, Math.max(0, updates.network_weight_cap || currentConfig.network_weight_cap)),
  };
  console.log('[Expansion T2.4] Config updated:', currentConfig);
  return { ...currentConfig };
}

export function shouldAutoRollback(context: {
  driftLevel: string;
  fpRate: number;
  divergence: number;
}): { rollback: boolean; reason?: string } {
  if (!currentConfig.auto_rollback_enabled) {
    return { rollback: false };
  }
  
  if (currentConfig.drift_block_levels.includes(context.driftLevel)) {
    return { rollback: true, reason: `Drift ${context.driftLevel} triggered rollback` };
  }
  
  if (context.fpRate > currentConfig.rollback_threshold_fp_rate) {
    return { rollback: true, reason: `FP rate ${(context.fpRate * 100).toFixed(1)}% exceeded threshold` };
  }
  
  if (context.divergence > currentConfig.divergence_max) {
    return { rollback: true, reason: `Divergence ${(context.divergence * 100).toFixed(1)}% exceeded max` };
  }
  
  return { rollback: false };
}

export function rollbackToBaseline(): ExpansionConfig {
  currentConfig = {
    ...currentConfig,
    network_weight_cap: 0.15,  // Back to baseline
  };
  console.log('[Expansion T2.4] Rolled back to baseline');
  return { ...currentConfig };
}
