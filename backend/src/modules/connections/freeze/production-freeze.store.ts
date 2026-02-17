/**
 * Production Freeze v1 - Store
 * 
 * MongoDB-backed storage for Production Freeze state
 */

import type { Collection, Db } from 'mongodb';
import type { ProductionFreezeConfig, ProductionFreezeStatus } from './production-freeze.types.js';
import { DEFAULT_PRODUCTION_FREEZE_CONFIG } from './production-freeze.types.js';

const CONFIG_COLLECTION = 'connections_production_freeze';
const FEEDBACK_COLLECTION = 'connections_freeze_feedback';
const CONFIG_DOC_ID = 'production_freeze_v1';

let configCollection: Collection | null = null;
let feedbackCollection: Collection | null = null;
let cachedConfig: ProductionFreezeConfig | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

export function initProductionFreezeStore(db: Db): void {
  configCollection = db.collection(CONFIG_COLLECTION);
  feedbackCollection = db.collection(FEEDBACK_COLLECTION);
  
  // Ensure indexes
  feedbackCollection.createIndex({ timestamp: -1 }).catch(() => {});
  feedbackCollection.createIndex({ type: 1 }).catch(() => {});
  feedbackCollection.createIndex({ alert_id: 1 }).catch(() => {});
  
  console.log('[ProductionFreeze] Store initialized');
}

// ============================================================
// CONFIG OPERATIONS
// ============================================================

export async function getProductionFreezeConfig(): Promise<ProductionFreezeConfig> {
  if (cachedConfig) return { ...cachedConfig };
  
  if (!configCollection) {
    console.warn('[ProductionFreeze] Store not initialized');
    return { ...DEFAULT_PRODUCTION_FREEZE_CONFIG };
  }
  
  const doc = await configCollection.findOne({ _id: CONFIG_DOC_ID as any });
  
  if (!doc) {
    await configCollection.insertOne({
      _id: CONFIG_DOC_ID as any,
      ...DEFAULT_PRODUCTION_FREEZE_CONFIG,
      created_at: new Date().toISOString(),
    });
    cachedConfig = { ...DEFAULT_PRODUCTION_FREEZE_CONFIG };
    return cachedConfig;
  }
  
  // Merge with defaults
  cachedConfig = {
    ...DEFAULT_PRODUCTION_FREEZE_CONFIG,
    ...doc,
    frozen_components: {
      ...DEFAULT_PRODUCTION_FREEZE_CONFIG.frozen_components,
      ...doc.frozen_components,
    },
    allowed_actions: {
      ...DEFAULT_PRODUCTION_FREEZE_CONFIG.allowed_actions,
      ...doc.allowed_actions,
    },
    blocked_actions: {
      ...DEFAULT_PRODUCTION_FREEZE_CONFIG.blocked_actions,
      ...doc.blocked_actions,
    },
    stats_collection: {
      ...DEFAULT_PRODUCTION_FREEZE_CONFIG.stats_collection,
      ...doc.stats_collection,
    },
  };
  
  return { ...cachedConfig };
}

export async function updateProductionFreezeConfig(
  updates: Partial<ProductionFreezeConfig>
): Promise<ProductionFreezeConfig> {
  if (!configCollection) throw new Error('ProductionFreeze store not initialized');
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $set: { ...updates, updated_at: new Date().toISOString() } },
    { upsert: true }
  );
  
  cachedConfig = null;
  return getProductionFreezeConfig();
}

// ============================================================
// FREEZE ACTIVATION
// ============================================================

export async function activateProductionFreeze(
  activatedBy: string = 'SYSTEM'
): Promise<ProductionFreezeConfig> {
  const now = new Date().toISOString();
  
  // Freeze all components
  const frozenComponents = { ...DEFAULT_PRODUCTION_FREEZE_CONFIG.frozen_components };
  for (const key of Object.keys(frozenComponents)) {
    (frozenComponents as any)[key].frozen_at = now;
    (frozenComponents as any)[key].can_modify = false;
  }
  
  const config = await updateProductionFreezeConfig({
    status: 'ACTIVE',
    activated_at: now,
    activated_by: activatedBy,
    frozen_components: frozenComponents,
    stats_collection: {
      ...DEFAULT_PRODUCTION_FREEZE_CONFIG.stats_collection,
      enabled: true,
      started_at: now,
    },
  });
  
  console.log(`[ProductionFreeze] 🧊 v1 ACTIVATED by ${activatedBy}`);
  console.log('[ProductionFreeze] All components FROZEN - no modifications allowed');
  
  return config;
}

export async function lockProductionFreeze(): Promise<ProductionFreezeConfig> {
  const config = await updateProductionFreezeConfig({
    status: 'LOCKED',
  });
  
  console.log('[ProductionFreeze] 🔒 LOCKED - permanent freeze');
  return config;
}

export async function isProductionFreezeActive(): Promise<boolean> {
  const config = await getProductionFreezeConfig();
  return config.status === 'ACTIVE' || config.status === 'LOCKED';
}

// ============================================================
// STATS OPERATIONS
// ============================================================

export async function recordFalsePositive(alertId: string, notes?: string): Promise<void> {
  if (!configCollection || !feedbackCollection) return;
  
  await feedbackCollection.insertOne({
    type: 'FALSE_POSITIVE',
    alert_id: alertId,
    notes,
    timestamp: new Date().toISOString(),
  });
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $inc: { 'stats_collection.fp_count': 1 } }
  );
  
  cachedConfig = null;
  console.log(`[ProductionFreeze] FP recorded: ${alertId}`);
}

export async function recordFalseNegative(description: string, notes?: string): Promise<void> {
  if (!configCollection || !feedbackCollection) return;
  
  await feedbackCollection.insertOne({
    type: 'FALSE_NEGATIVE',
    description,
    notes,
    timestamp: new Date().toISOString(),
  });
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $inc: { 'stats_collection.fn_count': 1 } }
  );
  
  cachedConfig = null;
  console.log('[ProductionFreeze] FN recorded');
}

export async function recordUsefulSignal(alertId: string, notes?: string): Promise<void> {
  if (!configCollection || !feedbackCollection) return;
  
  await feedbackCollection.insertOne({
    type: 'USEFUL_SIGNAL',
    alert_id: alertId,
    notes,
    timestamp: new Date().toISOString(),
  });
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $inc: { 'stats_collection.useful_signals': 1 } }
  );
  
  cachedConfig = null;
}

export async function recordTotalAlert(): Promise<void> {
  if (!configCollection) return;
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $inc: { 'stats_collection.total_alerts': 1 } }
  );
  
  cachedConfig = null;
}

export async function getFeedbackStats(): Promise<{
  fp_rate: number;
  fn_count: number;
  useful_rate: number;
  total_feedback: number;
}> {
  const config = await getProductionFreezeConfig();
  const stats = config.stats_collection;
  
  const total = stats.total_alerts || 1;
  
  return {
    fp_rate: stats.fp_count / total,
    fn_count: stats.fn_count,
    useful_rate: stats.useful_signals / total,
    total_feedback: stats.fp_count + stats.fn_count + stats.useful_signals,
  };
}

// ============================================================
// NETWORK V2 PREPARATION
// ============================================================

export async function setNetworkV2Status(
  status: 'NOT_STARTED' | 'PREPARING' | 'SHADOW' | 'ACTIVE'
): Promise<ProductionFreezeConfig> {
  const config = await updateProductionFreezeConfig({
    network_v2_status: status,
    network_v2_ready: status !== 'NOT_STARTED',
  });
  
  console.log(`[ProductionFreeze] Network v2 status: ${status}`);
  return config;
}

console.log('[ProductionFreeze] Store module loaded');
