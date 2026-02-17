/**
 * Pilot Accounts System (Phase 4.6)
 * 
 * Manages pilot rollout accounts for live testing.
 * Key principles:
 * - Pilot accounts stored in Connections module, NOT in parser
 * - Stricter guards than production
 * - Step-based weight escalation (A→B→C)
 * - Comprehensive monitoring
 */

import type { Collection, Db } from 'mongodb';
import { getParticipationConfig, updateParticipationConfig, rollbackAll } from '../../twitter-live/participation.config.js';
import { getAlertPolicyStore, initAlertPolicyStore } from '../alerts/alert-policy.store.js';

// ============================================================
// TYPES
// ============================================================

export type PilotStep = 'A' | 'B' | 'C' | 'OFF';
export type PilotAccountType = 'whale' | 'influencer' | 'retail' | 'suspicious';

export interface PilotAccount {
  _id?: any;
  account_id: string;
  username: string;
  type: PilotAccountType;
  added_at: string;
  added_by: string;
  
  // Status
  active: boolean;
  rolled_back: boolean;
  rollback_reason?: string;
  
  // Metrics tracking
  baseline_score?: number;
  current_score?: number;
  last_alert_at?: string;
  alerts_count: number;
  false_positives: number;
}

export interface PilotConfig {
  _id?: string;
  enabled: boolean;
  current_step: PilotStep;
  step_started_at: string;
  
  // Guard thresholds (stricter than prod)
  guards: {
    confidence_min: number;    // 70% for pilot (vs 65% prod)
    delta_max: number;         // 20% for pilot (vs 25% prod)
    spike_max: number;         // 1.7x for pilot (vs 2.0x prod)
    auto_rollback_threshold: number; // 1 event (vs 3 prod)
  };
  
  // Allowed alert types
  allowed_alert_types: string[];
  
  // Weights per step
  steps: {
    A: StepWeights;
    B: StepWeights;
    C: StepWeights;
  };
  
  // Telegram settings
  telegram: {
    admin_chat_id: string;
    prefix: string;
    notify_on_rollback: boolean;
  };
  
  // Timestamps
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface StepWeights {
  followers: number;
  engagement: number;
  graph_edges: number;
  audience_quality: number;
  authority: number;
}

export interface PilotStats {
  total_accounts: number;
  active_accounts: number;
  rolled_back_accounts: number;
  by_type: Record<PilotAccountType, number>;
  
  current_step: PilotStep;
  step_hours: number;
  
  alerts_24h: {
    sent: number;
    blocked: number;
    suppressed: number;
  };
  
  confidence_distribution: {
    high: number;   // >=80
    medium: number; // 65-79
    low: number;    // <65
  };
  
  false_positive_rate: number;
  dedup_collisions: number;
  
  last_rollback?: {
    timestamp: string;
    reason: string;
    account_id?: string;
  };
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_PILOT_CONFIG: PilotConfig = {
  enabled: false,
  current_step: 'OFF',
  step_started_at: new Date().toISOString(),
  
  guards: {
    confidence_min: 70,
    delta_max: 0.20,
    spike_max: 1.7,
    auto_rollback_threshold: 1,
  },
  
  allowed_alert_types: ['EARLY_BREAKOUT', 'STRONG_ACCELERATION'],
  
  steps: {
    A: {
      followers: 10,
      engagement: 10,
      graph_edges: 0,
      audience_quality: 0,
      authority: 0,
    },
    B: {
      followers: 20,
      engagement: 20,
      graph_edges: 15,
      audience_quality: 0,
      authority: 0,
    },
    C: {
      followers: 30,
      engagement: 30,
      graph_edges: 25,
      audience_quality: 15,
      authority: 10,
    },
  },
  
  telegram: {
    admin_chat_id: process.env.TELEGRAM_CHAT_ID || '',
    prefix: '[PILOT]',
    notify_on_rollback: true,
  },
  
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================
// PILOT STORE CLASS
// ============================================================

const CONFIG_DOC_ID = 'pilot_config_v1';

export class PilotStore {
  private configCol: Collection;
  private accountsCol: Collection;
  private metricsCol: Collection;
  
  constructor(db: Db) {
    this.configCol = db.collection('connections_pilot_config');
    this.accountsCol = db.collection('connections_pilot_accounts');
    this.metricsCol = db.collection('connections_pilot_metrics');
  }
  
  /**
   * Initialize indexes
   */
  async ensureIndexes(): Promise<void> {
    await this.accountsCol.createIndex({ account_id: 1 }, { unique: true, background: true });
    await this.accountsCol.createIndex({ type: 1 }, { background: true });
    await this.accountsCol.createIndex({ active: 1 }, { background: true });
    await this.metricsCol.createIndex({ timestamp: -1 }, { background: true });
    console.log('[PilotStore] Indexes ensured');
  }
  
  // ============================================================
  // CONFIG OPERATIONS
  // ============================================================
  
  async getConfig(): Promise<PilotConfig> {
    const doc = await this.configCol.findOne({ _id: CONFIG_DOC_ID as any });
    if (!doc?.config) {
      return { ...DEFAULT_PILOT_CONFIG };
    }
    return { ...DEFAULT_PILOT_CONFIG, ...doc.config };
  }
  
  async updateConfig(updates: Partial<PilotConfig>, updatedBy?: string): Promise<PilotConfig> {
    const current = await this.getConfig();
    const next: PilotConfig = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    };
    
    // Deep merge guards
    if (updates.guards) {
      next.guards = { ...current.guards, ...updates.guards };
    }
    
    // Deep merge steps
    if (updates.steps) {
      next.steps = {
        A: { ...current.steps.A, ...updates.steps.A },
        B: { ...current.steps.B, ...updates.steps.B },
        C: { ...current.steps.C, ...updates.steps.C },
      };
    }
    
    await this.configCol.updateOne(
      { _id: CONFIG_DOC_ID as any },
      { $set: { config: next } },
      { upsert: true }
    );
    
    return next;
  }
  
  // ============================================================
  // ACCOUNT OPERATIONS
  // ============================================================
  
  async addAccount(account: Omit<PilotAccount, '_id' | 'added_at' | 'alerts_count' | 'false_positives' | 'active' | 'rolled_back'>): Promise<PilotAccount> {
    const doc: PilotAccount = {
      ...account,
      added_at: new Date().toISOString(),
      active: true,
      rolled_back: false,
      alerts_count: 0,
      false_positives: 0,
    };
    
    await this.accountsCol.updateOne(
      { account_id: account.account_id },
      { $set: doc },
      { upsert: true }
    );
    
    return doc;
  }
  
  async getAccounts(filter?: { active?: boolean; type?: PilotAccountType }): Promise<PilotAccount[]> {
    const query: any = {};
    if (filter?.active !== undefined) query.active = filter.active;
    if (filter?.type) query.type = filter.type;
    
    return await this.accountsCol.find(query).toArray() as PilotAccount[];
  }
  
  async getAccount(accountId: string): Promise<PilotAccount | null> {
    return await this.accountsCol.findOne({ account_id: accountId }) as PilotAccount | null;
  }
  
  async updateAccount(accountId: string, updates: Partial<PilotAccount>): Promise<void> {
    await this.accountsCol.updateOne(
      { account_id: accountId },
      { $set: updates }
    );
  }
  
  async removeAccount(accountId: string): Promise<void> {
    await this.accountsCol.deleteOne({ account_id: accountId });
  }
  
  async rollbackAccount(accountId: string, reason: string): Promise<void> {
    await this.accountsCol.updateOne(
      { account_id: accountId },
      { 
        $set: { 
          active: false, 
          rolled_back: true, 
          rollback_reason: reason 
        } 
      }
    );
  }
  
  async incrementAlerts(accountId: string, falsePositive: boolean = false): Promise<void> {
    const update: any = {
      $inc: { alerts_count: 1 },
      $set: { last_alert_at: new Date().toISOString() },
    };
    if (falsePositive) {
      update.$inc.false_positives = 1;
    }
    await this.accountsCol.updateOne({ account_id: accountId }, update);
  }
  
  async isPilotAccount(accountId: string): Promise<boolean> {
    const account = await this.accountsCol.findOne({ account_id: accountId, active: true });
    return !!account;
  }
  
  // ============================================================
  // METRICS OPERATIONS
  // ============================================================
  
  async recordMetric(data: {
    step: PilotStep;
    alerts_sent: number;
    alerts_blocked: number;
    avg_confidence: number;
    top_divergences: Array<{ account_id: string; delta: number }>;
  }): Promise<void> {
    await this.metricsCol.insertOne({
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
  
  async getMetricsHistory(limit: number = 50): Promise<any[]> {
    return await this.metricsCol
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
  
  // ============================================================
  // STATS
  // ============================================================
  
  async getStats(): Promise<PilotStats> {
    const config = await this.getConfig();
    const accounts = await this.getAccounts();
    
    // Count by type
    const byType: Record<PilotAccountType, number> = {
      whale: 0,
      influencer: 0,
      retail: 0,
      suspicious: 0,
    };
    
    let activeCount = 0;
    let rolledBackCount = 0;
    let totalFP = 0;
    let totalAlerts = 0;
    
    for (const acc of accounts) {
      byType[acc.type]++;
      if (acc.active) activeCount++;
      if (acc.rolled_back) rolledBackCount++;
      totalFP += acc.false_positives;
      totalAlerts += acc.alerts_count;
    }
    
    // Calculate step hours
    const stepStarted = new Date(config.step_started_at).getTime();
    const stepHours = Math.floor((Date.now() - stepStarted) / (1000 * 60 * 60));
    
    // Get alert stats from policy store
    let alertStats = { sent: 0, blocked: 0, suppressed: 0 };
    let confidenceDist = { high: 0, medium: 0, low: 0 };
    
    try {
      const policyStore = getAlertPolicyStore();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const mongoStats = await policyStore.getAuditStats(since);
      alertStats = {
        sent: mongoStats.sent,
        blocked: mongoStats.blocked,
        suppressed: mongoStats.suppressed,
      };
      
      // Get audit for confidence distribution
      const audit = await policyStore.getAudit({ limit: 100, since });
      for (const entry of audit) {
        const conf = (entry as any).confidence_score || 0;
        if (conf >= 80) confidenceDist.high++;
        else if (conf >= 65) confidenceDist.medium++;
        else confidenceDist.low++;
      }
    } catch (err) {
      // Policy store not available
    }
    
    // Calculate FP rate
    const fpRate = totalAlerts > 0 ? (totalFP / totalAlerts) * 100 : 0;
    
    return {
      total_accounts: accounts.length,
      active_accounts: activeCount,
      rolled_back_accounts: rolledBackCount,
      by_type: byType,
      
      current_step: config.current_step,
      step_hours: stepHours,
      
      alerts_24h: alertStats,
      confidence_distribution: confidenceDist,
      
      false_positive_rate: Math.round(fpRate * 10) / 10,
      dedup_collisions: 0, // Dedup should always be 0
      
      last_rollback: undefined, // TODO: Track rollbacks
    };
  }
}

// ============================================================
// PILOT ENGINE
// ============================================================

let storeInstance: PilotStore | null = null;

export function initPilotStore(db: Db): PilotStore {
  if (!storeInstance) {
    storeInstance = new PilotStore(db);
    storeInstance.ensureIndexes().catch(err => {
      console.error('[PilotStore] Index creation failed:', err);
    });
  }
  return storeInstance;
}

export function getPilotStore(): PilotStore {
  if (!storeInstance) {
    throw new Error('PilotStore not initialized. Call initPilotStore(db) first.');
  }
  return storeInstance;
}

/**
 * Start pilot step
 */
export async function startPilotStep(step: PilotStep, updatedBy?: string): Promise<PilotConfig> {
  const store = getPilotStore();
  const config = await store.getConfig();
  
  if (step === 'OFF') {
    // Disable pilot and rollback participation
    rollbackAll('pilot_disabled', updatedBy);
    return await store.updateConfig({
      enabled: false,
      current_step: 'OFF',
      step_started_at: new Date().toISOString(),
    }, updatedBy);
  }
  
  // Apply step weights to participation config
  const weights = config.steps[step];
  
  updateParticipationConfig({
    enabled: true,
    mode: 'gradual',
    components: {
      followers: { enabled: weights.followers > 0, weight: weights.followers },
      engagement: { enabled: weights.engagement > 0, weight: weights.engagement },
      graph_edges: { enabled: weights.graph_edges > 0, weight: weights.graph_edges },
      audience_quality: { enabled: weights.audience_quality > 0, weight: weights.audience_quality },
      authority: { enabled: weights.authority > 0, weight: weights.authority },
    },
    guards: {
      min_confidence: config.guards.confidence_min,
      max_delta: config.guards.delta_max,
      max_spike: config.guards.spike_max,
      freshness_days: 14,
      max_safe_weight: 30,
    },
  }, updatedBy);
  
  return await store.updateConfig({
    enabled: true,
    current_step: step,
    step_started_at: new Date().toISOString(),
  }, updatedBy);
}

/**
 * Check if pilot conditions allow proceeding
 */
export async function checkPilotReadiness(): Promise<{
  ready: boolean;
  blockers: string[];
  warnings: string[];
}> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  
  try {
    const store = getPilotStore();
    const config = await store.getConfig();
    const accounts = await store.getAccounts({ active: true });
    
    // Check account count
    if (accounts.length < 10) {
      blockers.push(`Not enough pilot accounts: ${accounts.length}/10 minimum`);
    }
    
    if (accounts.length > 20) {
      warnings.push(`More than recommended pilot accounts: ${accounts.length}/20`);
    }
    
    // Check diversity
    const types = new Set(accounts.map(a => a.type));
    if (types.size < 3) {
      warnings.push(`Low account type diversity: ${types.size} types (recommend 3+)`);
    }
    
    // Check telegram
    if (!config.telegram.admin_chat_id) {
      blockers.push('No admin Telegram chat_id configured');
    }
    
    // Check policy store
    try {
      const policyStore = getAlertPolicyStore();
      const policyConfig = await policyStore.getConfig();
      if (!policyConfig.enabled) {
        warnings.push('Alert policy is disabled');
      }
    } catch (err) {
      blockers.push('Alert policy store not initialized');
    }
    
  } catch (err: any) {
    blockers.push(`Pilot store error: ${err.message}`);
  }
  
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}

console.log('[Pilot] Pilot System initialized (Phase 4.6)');
