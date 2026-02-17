/**
 * Silent Authority Service - Network v2
 * 
 * Manages Silent Authority detection, alerts, and cooldowns
 */

import type { Db, Collection } from 'mongodb';
import type { 
  SilentAuthorityConfig, 
  SilentAuthorityResult,
  SilentAuthorityInput,
} from './silent-authority.detector.js';
import { 
  DEFAULT_SILENT_AUTHORITY_CONFIG, 
  detectSilentAuthority,
  detectSilentAuthoritiesBatch,
} from './silent-authority.detector.js';

const CONFIG_COLLECTION = 'connections_silent_authority_config';
const ALERTS_COLLECTION = 'connections_silent_authority_alerts';
const CONFIG_DOC_ID = 'silent_authority_config_v1';

let configCollection: Collection | null = null;
let alertsCollection: Collection | null = null;
let cachedConfig: SilentAuthorityConfig | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

export function initSilentAuthorityService(db: Db): void {
  configCollection = db.collection(CONFIG_COLLECTION);
  alertsCollection = db.collection(ALERTS_COLLECTION);
  
  // Create indexes
  alertsCollection.createIndex({ account_id: 1, created_at: -1 }).catch(() => {});
  alertsCollection.createIndex({ created_at: -1 }).catch(() => {});
  alertsCollection.createIndex({ flag: 1 }).catch(() => {});
  
  console.log('[SilentAuthority] Service initialized');
}

// ============================================================
// CONFIG
// ============================================================

export async function getSilentAuthorityConfig(): Promise<SilentAuthorityConfig> {
  if (cachedConfig) return { ...cachedConfig };
  
  if (!configCollection) {
    return { ...DEFAULT_SILENT_AUTHORITY_CONFIG };
  }
  
  const doc = await configCollection.findOne({ _id: CONFIG_DOC_ID as any });
  
  if (!doc) {
    await configCollection.insertOne({
      _id: CONFIG_DOC_ID as any,
      ...DEFAULT_SILENT_AUTHORITY_CONFIG,
      created_at: new Date().toISOString(),
    });
    cachedConfig = { ...DEFAULT_SILENT_AUTHORITY_CONFIG };
    return cachedConfig;
  }
  
  cachedConfig = { 
    ...DEFAULT_SILENT_AUTHORITY_CONFIG, 
    ...doc,
    weights: { ...DEFAULT_SILENT_AUTHORITY_CONFIG.weights, ...(doc.weights || {}) },
  };
  return { ...cachedConfig };
}

export async function updateSilentAuthorityConfig(
  updates: Partial<SilentAuthorityConfig>
): Promise<SilentAuthorityConfig> {
  if (!configCollection) throw new Error('SilentAuthority not initialized');
  
  const current = await getSilentAuthorityConfig();
  const updated = {
    ...current,
    ...updates,
    weights: { ...current.weights, ...(updates.weights || {}) },
    updated_at: new Date().toISOString(),
  };
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $set: updated },
    { upsert: true }
  );
  
  cachedConfig = null;
  return getSilentAuthorityConfig();
}

// ============================================================
// DETECTION
// ============================================================

/**
 * Test detection on a single account
 */
export async function testDetection(input: SilentAuthorityInput): Promise<SilentAuthorityResult> {
  const cfg = await getSilentAuthorityConfig();
  return detectSilentAuthority(input, cfg);
}

/**
 * Batch detection
 */
export async function batchDetection(
  inputs: SilentAuthorityInput[]
): Promise<SilentAuthorityResult[]> {
  const cfg = await getSilentAuthorityConfig();
  return detectSilentAuthoritiesBatch(inputs, cfg);
}

// ============================================================
// ALERT MANAGEMENT
// ============================================================

/**
 * Check if account is in cooldown
 */
export async function isInCooldown(accountId: string): Promise<boolean> {
  if (!alertsCollection) return false;
  
  const cfg = await getSilentAuthorityConfig();
  const cooldownMs = cfg.alert_cooldown_hours * 3600 * 1000;
  const since = new Date(Date.now() - cooldownMs);
  
  const recent = await alertsCollection.findOne({
    account_id: accountId,
    created_at: { $gte: since },
  });
  
  return !!recent;
}

/**
 * Record a silent authority alert
 */
export async function recordAlert(result: SilentAuthorityResult): Promise<{
  recorded: boolean;
  reason?: string;
}> {
  if (!alertsCollection) {
    return { recorded: false, reason: 'Service not initialized' };
  }
  
  // Check cooldown
  const inCooldown = await isInCooldown(result.account_id);
  if (inCooldown) {
    return { recorded: false, reason: 'Account in cooldown' };
  }
  
  // Check if should alert
  if (!result.should_alert) {
    return { recorded: false, reason: 'Does not meet alert criteria' };
  }
  
  await alertsCollection.insertOne({
    ...result,
    created_at: new Date(),
  });
  
  console.log(`[SilentAuthority] 🔔 Alert recorded: @${result.handle} (${result.flag})`);
  return { recorded: true };
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(opts?: {
  limit?: number;
  flag?: string;
  since?: Date;
}): Promise<SilentAuthorityResult[]> {
  if (!alertsCollection) return [];
  
  const query: any = {};
  if (opts?.flag) query.flag = opts.flag;
  if (opts?.since) query.created_at = { $gte: opts.since };
  
  const alerts = await alertsCollection
    .find(query)
    .sort({ created_at: -1 })
    .limit(opts?.limit ?? 50)
    .toArray();
  
  return alerts as SilentAuthorityResult[];
}

/**
 * Get alert stats
 */
export async function getAlertStats(): Promise<{
  total_alerts: number;
  last_24h: number;
  by_flag: Record<string, number>;
  top_accounts: { handle: string; count: number }[];
}> {
  if (!alertsCollection) {
    return { total_alerts: 0, last_24h: 0, by_flag: {}, top_accounts: [] };
  }
  
  const total = await alertsCollection.countDocuments();
  
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const last24h = await alertsCollection.countDocuments({
    created_at: { $gte: yesterday },
  });
  
  // By flag
  const flagPipeline = [
    { $group: { _id: '$flag', count: { $sum: 1 } } },
  ];
  const flagResults = await alertsCollection.aggregate(flagPipeline).toArray();
  const byFlag: Record<string, number> = {};
  for (const r of flagResults) byFlag[r._id] = r.count;
  
  // Top accounts
  const topPipeline = [
    { $group: { _id: '$handle', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ];
  const topResults = await alertsCollection.aggregate(topPipeline).toArray();
  const topAccounts = topResults.map(r => ({ handle: r._id, count: r.count }));
  
  return {
    total_alerts: total,
    last_24h: last24h,
    by_flag: byFlag,
    top_accounts: topAccounts,
  };
}

console.log('[SilentAuthority] Service module loaded');
