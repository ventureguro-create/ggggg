/**
 * Real Accounts Module - T2.6
 * 
 * Manages transition from pilot/mock accounts to real Twitter accounts.
 * Validates that system works on real data without changing logic.
 */

import type { Collection, Db } from 'mongodb';

// ============================================================
// TYPES
// ============================================================

export type AccountSource = 'PILOT' | 'MOCK' | 'REAL';
export type AccountType = 'INFLUENCER' | 'SMART_NO_NAME' | 'NOISY' | 'SUSPICIOUS';

export interface RealAccount {
  _id?: any;
  twitter_id: string;
  handle: string;
  source: AccountSource;
  type: AccountType;
  added_at: string;
  added_by: string;
  
  // Validation status
  validation_status: 'PENDING' | 'VALIDATED' | 'REJECTED';
  validation_notes?: string;
  
  // Performance tracking
  stats: {
    alerts_generated: number;
    alerts_sent: number;
    alerts_suppressed: number;
    false_positives: number;
    confidence_avg: number;
  };
  
  // Flags
  is_active: boolean;
  is_pilot: boolean;
}

export interface T26Config {
  version: string;
  status: 'INACTIVE' | 'ACTIVE';
  activated_at: string | null;
  
  // Account limits
  max_real_accounts: number;
  current_real_accounts: number;
  
  // Validation gates
  validation: {
    require_manual_approval: boolean;
    auto_validate_pilot: boolean;
    min_tweets_required: number;
    min_followers_required: number;
  };
  
  // Alert constraints (inherits from T2.5)
  alerts: {
    confidence_gate: number;        // 0.70
    aqm_required: boolean;
    rate_limit_per_hour: number;
    ml2_check_enabled: boolean;     // Log only
  };
  
  // Monitoring
  monitoring: {
    fp_rate_current: number;
    drift_level: string;
    smart_no_name_in_alerts: boolean;
    noise_rate: number;
  };
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

export const DEFAULT_T26_CONFIG: T26Config = {
  version: 'T2.6',
  status: 'INACTIVE',
  activated_at: null,
  
  max_real_accounts: 100,
  current_real_accounts: 0,
  
  validation: {
    require_manual_approval: true,
    auto_validate_pilot: true,
    min_tweets_required: 50,
    min_followers_required: 100,
  },
  
  alerts: {
    confidence_gate: 0.70,
    aqm_required: true,
    rate_limit_per_hour: 50,
    ml2_check_enabled: true,
  },
  
  monitoring: {
    fp_rate_current: 0,
    drift_level: 'LOW',
    smart_no_name_in_alerts: true,
    noise_rate: 0,
  },
};

// ============================================================
// STORE
// ============================================================

const ACCOUNTS_COLLECTION = 'connections_real_accounts';
const CONFIG_COLLECTION = 'connections_t26_config';
const CONFIG_DOC_ID = 't26_config_v1';

let accountsCollection: Collection | null = null;
let configCollection: Collection | null = null;
let cachedConfig: T26Config | null = null;

/**
 * Initialize T2.6 store
 */
export function initT26Store(db: Db): void {
  accountsCollection = db.collection(ACCOUNTS_COLLECTION);
  configCollection = db.collection(CONFIG_COLLECTION);
  
  // Ensure indexes
  accountsCollection.createIndex({ twitter_id: 1 }, { unique: true }).catch(() => {});
  accountsCollection.createIndex({ handle: 1 }).catch(() => {});
  accountsCollection.createIndex({ source: 1, is_active: 1 }).catch(() => {});
  accountsCollection.createIndex({ type: 1 }).catch(() => {});
  
  console.log('[T2.6] Store initialized');
}

/**
 * Get T2.6 config
 */
export async function getT26Config(): Promise<T26Config> {
  if (cachedConfig) return { ...cachedConfig };
  
  if (!configCollection) {
    return { ...DEFAULT_T26_CONFIG };
  }
  
  const doc = await configCollection.findOne({ _id: CONFIG_DOC_ID as any });
  
  if (!doc) {
    await configCollection.insertOne({
      _id: CONFIG_DOC_ID as any,
      ...DEFAULT_T26_CONFIG,
      created_at: new Date().toISOString(),
    });
    cachedConfig = { ...DEFAULT_T26_CONFIG };
    return cachedConfig;
  }
  
  cachedConfig = { ...DEFAULT_T26_CONFIG, ...doc };
  return { ...cachedConfig };
}

/**
 * Update T2.6 config
 */
export async function updateT26Config(updates: Partial<T26Config>): Promise<T26Config> {
  if (!configCollection) throw new Error('T2.6 store not initialized');
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $set: { ...updates, updated_at: new Date().toISOString() } },
    { upsert: true }
  );
  
  cachedConfig = null;
  return getT26Config();
}

/**
 * Activate T2.6
 */
export async function activateT26(): Promise<T26Config> {
  const config = await updateT26Config({
    status: 'ACTIVE',
    activated_at: new Date().toISOString(),
  });
  
  console.log('[T2.6] 🚀 ACTIVATED - Pilot → Real Accounts mode');
  return config;
}

// ============================================================
// ACCOUNT OPERATIONS
// ============================================================

/**
 * Add real account
 */
export async function addRealAccount(account: Omit<RealAccount, '_id' | 'stats' | 'added_at'>): Promise<RealAccount> {
  if (!accountsCollection) throw new Error('T2.6 store not initialized');
  
  const config = await getT26Config();
  
  // Check limit
  if (config.current_real_accounts >= config.max_real_accounts) {
    throw new Error(`Max real accounts limit reached: ${config.max_real_accounts}`);
  }
  
  const doc: RealAccount = {
    ...account,
    added_at: new Date().toISOString(),
    stats: {
      alerts_generated: 0,
      alerts_sent: 0,
      alerts_suppressed: 0,
      false_positives: 0,
      confidence_avg: 0,
    },
  };
  
  // Auto-validate pilot accounts
  if (account.is_pilot && config.validation.auto_validate_pilot) {
    doc.validation_status = 'VALIDATED';
  }
  
  await accountsCollection.insertOne(doc);
  
  // Update counter
  if (account.source === 'REAL') {
    await updateT26Config({ 
      current_real_accounts: config.current_real_accounts + 1 
    });
  }
  
  console.log(`[T2.6] Account added: @${account.handle} (${account.source}/${account.type})`);
  return doc;
}

/**
 * Get accounts
 */
export async function getAccounts(opts?: {
  source?: AccountSource;
  type?: AccountType;
  active_only?: boolean;
  limit?: number;
}): Promise<RealAccount[]> {
  if (!accountsCollection) return [];
  
  const query: any = {};
  
  if (opts?.source) query.source = opts.source;
  if (opts?.type) query.type = opts.type;
  if (opts?.active_only) query.is_active = true;
  
  const accounts = await accountsCollection
    .find(query)
    .sort({ added_at: -1 })
    .limit(opts?.limit ?? 100)
    .toArray();
  
  return accounts as RealAccount[];
}

/**
 * Get account stats
 */
export async function getAccountStats(): Promise<{
  total: number;
  by_source: Record<string, number>;
  by_type: Record<string, number>;
  active: number;
  validated: number;
}> {
  if (!accountsCollection) {
    return { total: 0, by_source: {}, by_type: {}, active: 0, validated: 0 };
  }
  
  const pipeline = [
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$is_active', 1, 0] } },
        validated: { $sum: { $cond: [{ $eq: ['$validation_status', 'VALIDATED'] }, 1, 0] } },
      },
    },
  ];
  
  const results = await accountsCollection.aggregate(pipeline).toArray();
  const stats = results[0] || { total: 0, active: 0, validated: 0 };
  
  // Get by source
  const sourcePipeline = [
    { $group: { _id: '$source', count: { $sum: 1 } } },
  ];
  const sourceResults = await accountsCollection.aggregate(sourcePipeline).toArray();
  const by_source: Record<string, number> = {};
  for (const r of sourceResults) by_source[r._id] = r.count;
  
  // Get by type
  const typePipeline = [
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ];
  const typeResults = await accountsCollection.aggregate(typePipeline).toArray();
  const by_type: Record<string, number> = {};
  for (const r of typeResults) by_type[r._id] = r.count;
  
  return {
    total: stats.total,
    active: stats.active,
    validated: stats.validated,
    by_source,
    by_type,
  };
}

/**
 * Validate account
 */
export async function validateAccount(
  twitterId: string, 
  status: 'VALIDATED' | 'REJECTED',
  notes?: string
): Promise<void> {
  if (!accountsCollection) return;
  
  await accountsCollection.updateOne(
    { twitter_id: twitterId },
    { 
      $set: { 
        validation_status: status,
        validation_notes: notes,
        validated_at: new Date().toISOString(),
      } 
    }
  );
  
  console.log(`[T2.6] Account ${twitterId} ${status}`);
}

/**
 * Update account stats
 */
export async function updateAccountStats(
  twitterId: string,
  statsUpdate: Partial<RealAccount['stats']>
): Promise<void> {
  if (!accountsCollection) return;
  
  const update: any = {};
  for (const [key, value] of Object.entries(statsUpdate)) {
    update[`stats.${key}`] = value;
  }
  
  await accountsCollection.updateOne(
    { twitter_id: twitterId },
    { $inc: update }
  );
}

console.log('[T2.6] Real Accounts module loaded');
