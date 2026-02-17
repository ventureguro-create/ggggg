/**
 * Micro-Freeze Store - T2.5
 * 
 * MongoDB-backed storage for Micro-Freeze configuration and violations
 */

import type { Collection, Db } from 'mongodb';
import type { 
  MicroFreezeConfig, 
  FreezeViolation, 
  FreezeStatus,
  ViolationType 
} from './micro-freeze.types.js';
import { DEFAULT_MICRO_FREEZE_CONFIG } from './micro-freeze.types.js';

const CONFIG_COLLECTION = 'connections_micro_freeze_config';
const VIOLATIONS_COLLECTION = 'connections_micro_freeze_violations';
const CONFIG_DOC_ID = 'micro_freeze_v1';

let configCollection: Collection | null = null;
let violationsCollection: Collection | null = null;
let cachedConfig: MicroFreezeConfig | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

export function initMicroFreezeStore(db: Db): void {
  configCollection = db.collection(CONFIG_COLLECTION);
  violationsCollection = db.collection(VIOLATIONS_COLLECTION);
  
  // Ensure indexes
  violationsCollection.createIndex({ timestamp: -1 }).catch(() => {});
  violationsCollection.createIndex({ type: 1, timestamp: -1 }).catch(() => {});
  
  console.log('[MicroFreeze] Store initialized');
}

// ============================================================
// CONFIG OPERATIONS
// ============================================================

/**
 * Get current Micro-Freeze config
 */
export async function getMicroFreezeConfig(): Promise<MicroFreezeConfig> {
  if (cachedConfig) return { ...cachedConfig };
  
  if (!configCollection) {
    console.warn('[MicroFreeze] Store not initialized, using defaults');
    return { ...DEFAULT_MICRO_FREEZE_CONFIG };
  }
  
  const doc = await configCollection.findOne({ _id: CONFIG_DOC_ID as any });
  
  if (!doc) {
    // Create default config
    await configCollection.insertOne({
      _id: CONFIG_DOC_ID as any,
      ...DEFAULT_MICRO_FREEZE_CONFIG,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    cachedConfig = { ...DEFAULT_MICRO_FREEZE_CONFIG };
    return cachedConfig;
  }
  
  cachedConfig = {
    version: doc.version || DEFAULT_MICRO_FREEZE_CONFIG.version,
    status: doc.status || DEFAULT_MICRO_FREEZE_CONFIG.status,
    level: doc.level || DEFAULT_MICRO_FREEZE_CONFIG.level,
    activated_at: doc.activated_at || null,
    activated_by: doc.activated_by || null,
    alert_pipeline: { ...DEFAULT_MICRO_FREEZE_CONFIG.alert_pipeline, ...doc.alert_pipeline },
    network: { ...DEFAULT_MICRO_FREEZE_CONFIG.network, ...doc.network },
    drift: { ...DEFAULT_MICRO_FREEZE_CONFIG.drift, ...doc.drift },
    ml2: { ...DEFAULT_MICRO_FREEZE_CONFIG.ml2, ...doc.ml2 },
    acceptance_criteria: { ...DEFAULT_MICRO_FREEZE_CONFIG.acceptance_criteria, ...doc.acceptance_criteria },
    auto_guards: { ...DEFAULT_MICRO_FREEZE_CONFIG.auto_guards, ...doc.auto_guards },
    last_violation_check: doc.last_violation_check || null,
    violations_blocked: doc.violations_blocked || 0,
    rollbacks_triggered: doc.rollbacks_triggered || 0,
  };
  
  return { ...cachedConfig };
}

/**
 * Update Micro-Freeze config (internal use only)
 */
export async function updateMicroFreezeConfig(
  updates: Partial<MicroFreezeConfig>
): Promise<MicroFreezeConfig> {
  if (!configCollection) {
    throw new Error('MicroFreeze store not initialized');
  }
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { 
      $set: { 
        ...updates, 
        updated_at: new Date().toISOString() 
      } 
    },
    { upsert: true }
  );
  
  // Clear cache
  cachedConfig = null;
  
  console.log('[MicroFreeze] Config updated:', Object.keys(updates));
  return getMicroFreezeConfig();
}

/**
 * Activate Micro-Freeze
 */
export async function activateMicroFreeze(activatedBy: string = 'SYSTEM'): Promise<MicroFreezeConfig> {
  const config = await updateMicroFreezeConfig({
    status: 'ACTIVE',
    activated_at: new Date().toISOString(),
    activated_by: activatedBy,
  });
  
  console.log(`[MicroFreeze] 🧊 ACTIVATED by ${activatedBy}`);
  return config;
}

/**
 * Deactivate Micro-Freeze (careful!)
 */
export async function deactivateMicroFreeze(reason: string = 'MANUAL'): Promise<MicroFreezeConfig> {
  const config = await updateMicroFreezeConfig({
    status: 'INACTIVE',
  });
  
  // Log this as a special event
  await logViolation({
    type: 'DRIFT_BYPASS_ATTEMPT',
    attempted_by: 'SYSTEM',
    attempted_value: { reason },
    blocked: false,
    details: `Micro-Freeze deactivated: ${reason}`,
  });
  
  console.log(`[MicroFreeze] ⚠️ DEACTIVATED: ${reason}`);
  return config;
}

/**
 * Check if Micro-Freeze is active
 */
export async function isMicroFreezeActive(): Promise<boolean> {
  const config = await getMicroFreezeConfig();
  return config.status === 'ACTIVE';
}

/**
 * Increment violations counter
 */
export async function incrementViolationsBlocked(): Promise<void> {
  if (!configCollection) return;
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { 
      $inc: { violations_blocked: 1 },
      $set: { last_violation_check: new Date().toISOString() }
    }
  );
  
  cachedConfig = null;
}

/**
 * Increment rollbacks counter
 */
export async function incrementRollbacksTriggered(): Promise<void> {
  if (!configCollection) return;
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $inc: { rollbacks_triggered: 1 } }
  );
  
  cachedConfig = null;
}

// ============================================================
// VIOLATION LOGGING
// ============================================================

/**
 * Log a freeze violation attempt
 */
export async function logViolation(violation: Omit<FreezeViolation, 'timestamp'>): Promise<void> {
  if (!violationsCollection) return;
  
  const doc: FreezeViolation = {
    ...violation,
    timestamp: new Date().toISOString(),
  };
  
  await violationsCollection.insertOne(doc);
  
  if (violation.blocked) {
    await incrementViolationsBlocked();
    console.log(`[MicroFreeze] ⛔ VIOLATION BLOCKED: ${violation.type} by ${violation.attempted_by}`);
  } else {
    console.log(`[MicroFreeze] ⚠️ Violation logged: ${violation.type}`);
  }
}

/**
 * Get recent violations
 */
export async function getViolations(opts?: {
  limit?: number;
  type?: ViolationType;
  since?: string;
  blocked_only?: boolean;
}): Promise<FreezeViolation[]> {
  if (!violationsCollection) return [];
  
  const query: any = {};
  
  if (opts?.type) query.type = opts.type;
  if (opts?.since) query.timestamp = { $gte: opts.since };
  if (opts?.blocked_only) query.blocked = true;
  
  const violations = await violationsCollection
    .find(query)
    .sort({ timestamp: -1 })
    .limit(opts?.limit ?? 100)
    .toArray();
  
  return violations as FreezeViolation[];
}

/**
 * Get violation stats
 */
export async function getViolationStats(since?: string): Promise<{
  total: number;
  blocked: number;
  by_type: Record<string, number>;
}> {
  if (!violationsCollection) {
    return { total: 0, blocked: 0, by_type: {} };
  }
  
  const match: any = {};
  if (since) match.timestamp = { $gte: since };
  
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { type: '$type', blocked: '$blocked' },
        count: { $sum: 1 },
      },
    },
  ];
  
  const results = await violationsCollection.aggregate(pipeline).toArray();
  
  const stats = {
    total: 0,
    blocked: 0,
    by_type: {} as Record<string, number>,
  };
  
  for (const r of results) {
    stats.total += r.count;
    if (r._id.blocked) stats.blocked += r.count;
    stats.by_type[r._id.type] = (stats.by_type[r._id.type] || 0) + r.count;
  }
  
  return stats;
}

console.log('[MicroFreeze] Store module loaded');
