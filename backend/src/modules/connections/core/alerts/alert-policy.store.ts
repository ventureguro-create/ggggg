/**
 * Alert Policy Store (Phase 4.5.1 + 4.5.2)
 * 
 * MongoDB-backed storage for:
 * - Policy configuration (kill-switch, thresholds)
 * - Alert audit log (SEND/BLOCK/SUPPRESS decisions)
 * - Dedup tracking (unique index on hash)
 * - Pending queue (alerts awaiting dispatch)
 */

import type { Collection, Db } from 'mongodb';
import crypto from 'crypto';
import type { AlertPolicyConfig, AlertType, AlertDecision, BlockReason, AlertPayload, AlertCandidate } from './alert-policy.engine.js';
import { DEFAULT_ALERT_POLICY } from './alert-policy.engine.js';

// ============================================================
// TYPES
// ============================================================

export interface AuditEntry {
  _id?: any;
  alert_id?: string;
  dedup_hash: string;
  
  // Context
  account_id: string;
  account_handle: string;
  alert_type: AlertType;
  
  // Decision
  decision: AlertDecision;
  block_reasons: BlockReason[];
  
  // Snapshot
  confidence_score: number;
  score_from: number;
  score_to: number;
  delta_pct: number;
  live_weight: number;
  
  // Policy version (for dedup window)
  policy_version: string;
  window_start: string;
  
  // State
  delivered: boolean;
  pending: boolean;
  
  // Timestamps
  created_at: string;
  delivered_at?: string;
}

export interface PendingAlert {
  _id?: any;
  alert_id: string;
  payload: AlertPayload;
  created_at: string;
  dedup_hash: string;
}

// ============================================================
// DEDUP HELPERS
// ============================================================

const DEDUP_WINDOWS_HOURS: Record<AlertType, number> = {
  EARLY_BREAKOUT: 24,
  STRONG_ACCELERATION: 12,
  TREND_REVERSAL: 12,
};

/**
 * Compute window start for dedup
 */
export function computeWindowStart(alertType: AlertType, ts = Date.now()): string {
  const hours = DEDUP_WINDOWS_HOURS[alertType];
  const windowMs = hours * 3600 * 1000;
  return new Date(Math.floor(ts / windowMs) * windowMs).toISOString();
}

/**
 * Compute dedup hash
 * 
 * Hash = sha256(account_id | alert_type | window_start | policy_version)
 * 
 * This ensures:
 * - Same account + type + window = blocked
 * - Policy version change resets dedup (intentional)
 */
export function computeDedupHash(params: {
  account_id: string;
  alert_type: AlertType;
  window_start: string;
  policy_version: string;
}): string {
  const raw = `${params.account_id}|${params.alert_type}|${params.window_start}|${params.policy_version}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ============================================================
// ALERT POLICY STORE CLASS
// ============================================================

const CONFIG_DOC_ID = 'connections_alert_policy_v1';
const POLICY_VERSION = '4.5.2';

export class AlertPolicyStore {
  private configCol: Collection;
  private auditCol: Collection;
  private pendingCol: Collection;
  
  constructor(db: Db) {
    this.configCol = db.collection('connections_alert_config');
    this.auditCol = db.collection('connections_alert_audit');
    this.pendingCol = db.collection('connections_alert_pending');
  }
  
  /**
   * Initialize indexes (call on startup)
   */
  async ensureIndexes(): Promise<void> {
    // Unique index on dedup_hash - THIS IS THE HARD GUARANTEE
    await this.auditCol.createIndex(
      { dedup_hash: 1 },
      { unique: true, background: true }
    );
    
    // Query indexes
    await this.auditCol.createIndex({ created_at: -1 }, { background: true });
    await this.auditCol.createIndex({ account_id: 1, created_at: -1 }, { background: true });
    await this.auditCol.createIndex({ decision: 1, created_at: -1 }, { background: true });
    
    // Pending alerts index
    await this.pendingCol.createIndex({ created_at: 1 }, { background: true });
    await this.pendingCol.createIndex({ dedup_hash: 1 }, { unique: true, background: true });
    
    console.log('[AlertPolicyStore] Indexes ensured');
  }
  
  // ============================================================
  // CONFIG OPERATIONS
  // ============================================================
  
  /**
   * Get policy config
   */
  async getConfig(): Promise<AlertPolicyConfig> {
    const doc = await this.configCol.findOne({ _id: CONFIG_DOC_ID as any });
    if (!doc?.config) {
      return { ...DEFAULT_ALERT_POLICY };
    }
    return { ...DEFAULT_ALERT_POLICY, ...doc.config };
  }
  
  /**
   * Update policy config
   */
  async updateConfig(updates: Partial<AlertPolicyConfig>): Promise<AlertPolicyConfig> {
    const current = await this.getConfig();
    const next: AlertPolicyConfig = {
      ...current,
      ...updates,
    };
    
    // Deep merge cooldown_per_type
    if (updates.cooldown_per_type) {
      next.cooldown_per_type = {
        ...current.cooldown_per_type,
        ...updates.cooldown_per_type,
      };
    }
    
    // Deep merge types_enabled
    if (updates.types_enabled) {
      next.types_enabled = {
        ...current.types_enabled,
        ...updates.types_enabled,
      };
    }
    
    await this.configCol.updateOne(
      { _id: CONFIG_DOC_ID as any },
      { 
        $set: { 
          config: next, 
          updated_at: new Date().toISOString(),
          policy_version: POLICY_VERSION,
        } 
      },
      { upsert: true }
    );
    
    return next;
  }
  
  /**
   * Kill switch - disable all alerts
   */
  async killSwitch(reason: string = 'MANUAL'): Promise<void> {
    await this.updateConfig({ enabled: false });
    
    // Log kill switch activation
    await this.auditCol.insertOne({
      dedup_hash: `killswitch_${Date.now()}`,
      account_id: 'SYSTEM',
      account_handle: 'SYSTEM',
      alert_type: 'EARLY_BREAKOUT' as AlertType,
      decision: 'BLOCK' as AlertDecision,
      block_reasons: ['DISABLED'],
      confidence_score: 0,
      score_from: 0,
      score_to: 0,
      delta_pct: 0,
      live_weight: 0,
      policy_version: POLICY_VERSION,
      window_start: new Date().toISOString(),
      delivered: false,
      pending: false,
      created_at: new Date().toISOString(),
      system_event: 'KILL_SWITCH',
      system_reason: reason,
    });
    
    console.log(`[AlertPolicyStore] KILL SWITCH ACTIVATED: ${reason}`);
  }
  
  /**
   * Auto-disable on rollback
   */
  async onRollback(): Promise<void> {
    await this.updateConfig({ 
      enabled: false,
      rollback_active: true,
    });
    
    console.log('[AlertPolicyStore] AUTO-DISABLED: Rollback detected');
  }
  
  // ============================================================
  // AUDIT OPERATIONS
  // ============================================================
  
  /**
   * Log decision (with dedup check)
   * 
   * Returns:
   * - { ok: true, duplicate: false } - logged successfully
   * - { ok: true, duplicate: true } - dedup blocked (already exists)
   * - { ok: false, error } - other error
   */
  async logDecision(entry: Omit<AuditEntry, 'created_at' | 'dedup_hash' | 'policy_version' | 'window_start'>): Promise<{
    ok: boolean;
    duplicate: boolean;
    error?: string;
  }> {
    const windowStart = computeWindowStart(entry.alert_type);
    const dedupHash = computeDedupHash({
      account_id: entry.account_id,
      alert_type: entry.alert_type,
      window_start: windowStart,
      policy_version: POLICY_VERSION,
    });
    
    const doc: AuditEntry = {
      ...entry,
      dedup_hash: dedupHash,
      policy_version: POLICY_VERSION,
      window_start: windowStart,
      created_at: new Date().toISOString(),
    };
    
    try {
      await this.auditCol.insertOne(doc);
      return { ok: true, duplicate: false };
    } catch (err: any) {
      // Duplicate key error = dedup blocked
      if (err.code === 11000) {
        console.log(`[AlertPolicyStore] DEDUP BLOCKED: ${entry.account_id}:${entry.alert_type}`);
        return { ok: true, duplicate: true };
      }
      console.error('[AlertPolicyStore] Audit log error:', err);
      return { ok: false, duplicate: false, error: err.message };
    }
  }
  
  /**
   * Check if in cooldown (using audit log)
   */
  async isInCooldown(
    accountId: string,
    alertType: AlertType,
    cooldownHours: number
  ): Promise<boolean> {
    const since = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();
    
    const existing = await this.auditCol.findOne({
      account_id: accountId,
      alert_type: alertType,
      decision: 'SEND',
      created_at: { $gte: since },
    });
    
    return !!existing;
  }
  
  /**
   * Get audit log
   */
  async getAudit(opts?: {
    limit?: number;
    decision?: AlertDecision;
    account_id?: string;
    since?: string;
  }): Promise<AuditEntry[]> {
    const query: any = {};
    
    if (opts?.decision) query.decision = opts.decision;
    if (opts?.account_id) query.account_id = opts.account_id;
    if (opts?.since) query.created_at = { $gte: opts.since };
    
    const entries = await this.auditCol
      .find(query)
      .sort({ created_at: -1 })
      .limit(opts?.limit ?? 100)
      .toArray();
    
    return entries as AuditEntry[];
  }
  
  /**
   * Get audit stats
   */
  async getAuditStats(since?: string): Promise<{
    total: number;
    sent: number;
    blocked: number;
    suppressed: number;
    by_reason: Record<string, number>;
  }> {
    const match: any = {};
    if (since) match.created_at = { $gte: since };
    
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$decision',
          count: { $sum: 1 },
        },
      },
    ];
    
    const results = await this.auditCol.aggregate(pipeline).toArray();
    
    const stats = {
      total: 0,
      sent: 0,
      blocked: 0,
      suppressed: 0,
      by_reason: {} as Record<string, number>,
    };
    
    for (const r of results) {
      stats.total += r.count;
      if (r._id === 'SEND') stats.sent = r.count;
      if (r._id === 'BLOCK') stats.blocked = r.count;
      if (r._id === 'SUPPRESS') stats.suppressed = r.count;
    }
    
    // Get block reasons breakdown
    const reasonsPipeline = [
      { $match: { ...match, decision: 'BLOCK' } },
      { $unwind: '$block_reasons' },
      { $group: { _id: '$block_reasons', count: { $sum: 1 } } },
    ];
    
    const reasonsResults = await this.auditCol.aggregate(reasonsPipeline).toArray();
    for (const r of reasonsResults) {
      stats.by_reason[r._id] = r.count;
    }
    
    return stats;
  }
  
  /**
   * Mark as delivered
   */
  async markDelivered(alertId: string): Promise<void> {
    await this.auditCol.updateOne(
      { alert_id: alertId },
      { $set: { delivered: true, delivered_at: new Date().toISOString() } }
    );
  }
  
  // ============================================================
  // PENDING QUEUE OPERATIONS
  // ============================================================
  
  /**
   * Add to pending queue
   */
  async addPending(alert: PendingAlert): Promise<{ ok: boolean; duplicate: boolean }> {
    try {
      await this.pendingCol.insertOne(alert);
      return { ok: true, duplicate: false };
    } catch (err: any) {
      if (err.code === 11000) {
        return { ok: true, duplicate: true };
      }
      throw err;
    }
  }
  
  /**
   * Get pending alerts
   */
  async getPending(limit: number = 50): Promise<PendingAlert[]> {
    return await this.pendingCol
      .find({})
      .sort({ created_at: 1 })
      .limit(limit)
      .toArray() as PendingAlert[];
  }
  
  /**
   * Remove from pending (after dispatch)
   */
  async removePending(alertId: string): Promise<void> {
    await this.pendingCol.deleteOne({ alert_id: alertId });
  }
  
  /**
   * Get pending count
   */
  async getPendingCount(): Promise<number> {
    return await this.pendingCol.countDocuments();
  }
  
  /**
   * Clear all pending
   */
  async clearPending(): Promise<number> {
    const result = await this.pendingCol.deleteMany({});
    return result.deletedCount;
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let storeInstance: AlertPolicyStore | null = null;

export function initAlertPolicyStore(db: Db): AlertPolicyStore {
  if (!storeInstance) {
    storeInstance = new AlertPolicyStore(db);
    storeInstance.ensureIndexes().catch(err => {
      console.error('[AlertPolicyStore] Index creation failed:', err);
    });
  }
  return storeInstance;
}

export function getAlertPolicyStore(): AlertPolicyStore {
  if (!storeInstance) {
    throw new Error('AlertPolicyStore not initialized. Call initAlertPolicyStore(db) first.');
  }
  return storeInstance;
}
