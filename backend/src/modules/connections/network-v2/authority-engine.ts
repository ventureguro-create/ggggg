/**
 * Network v2 - Authority Engine
 * 
 * Calculates and manages authority scores for all accounts
 * Builds the network influence graph
 */

import type { Db, Collection } from 'mongodb';
import type {
  NetworkV2Profile,
  NetworkV2Config,
  AuthorityScore,
} from './network-v2.types.js';
import { DEFAULT_NETWORK_V2_CONFIG } from './network-v2.types.js';
import { calculateAuthority, calculateEliteExposure, getGraphStats } from './follow-graph.reader.js';

// ============================================================
// STORAGE
// ============================================================

let db: Db | null = null;
let profilesCollection: Collection | null = null;
let configCollection: Collection | null = null;

const PROFILES_COLLECTION = 'connections_network_v2_profiles';
const CONFIG_COLLECTION = 'connections_network_v2_config';
const CONFIG_DOC_ID = 'network_v2_config';

let cachedConfig: NetworkV2Config | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

export function initAuthorityEngine(database: Db): void {
  db = database;
  profilesCollection = db.collection(PROFILES_COLLECTION);
  configCollection = db.collection(CONFIG_COLLECTION);
  
  // Create indexes
  profilesCollection.createIndex({ account_id: 1 }, { unique: true }).catch(() => {});
  profilesCollection.createIndex({ handle: 1 }).catch(() => {});
  profilesCollection.createIndex({ network_influence: -1 }).catch(() => {});
  profilesCollection.createIndex({ smart_no_name_score: -1 }).catch(() => {});
  profilesCollection.createIndex({ 'authority.tier': 1 }).catch(() => {});
  
  console.log('[NetworkV2] Authority Engine initialized');
}

// ============================================================
// CONFIG OPERATIONS
// ============================================================

export async function getNetworkV2Config(): Promise<NetworkV2Config> {
  if (cachedConfig) return { ...cachedConfig };
  
  if (!configCollection) {
    return { ...DEFAULT_NETWORK_V2_CONFIG };
  }
  
  const doc = await configCollection.findOne({ _id: CONFIG_DOC_ID as any });
  
  if (!doc) {
    await configCollection.insertOne({
      _id: CONFIG_DOC_ID as any,
      ...DEFAULT_NETWORK_V2_CONFIG,
      created_at: new Date().toISOString(),
    });
    cachedConfig = { ...DEFAULT_NETWORK_V2_CONFIG };
    return cachedConfig;
  }
  
  cachedConfig = { ...DEFAULT_NETWORK_V2_CONFIG, ...doc };
  return { ...cachedConfig };
}

export async function updateNetworkV2Config(
  updates: Partial<NetworkV2Config>
): Promise<NetworkV2Config> {
  if (!configCollection) throw new Error('Authority Engine not initialized');
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $set: { ...updates, updated_at: new Date().toISOString() } },
    { upsert: true }
  );
  
  cachedConfig = null;
  return getNetworkV2Config();
}

export async function setNetworkV2Status(
  status: 'DISABLED' | 'SHADOW' | 'ACTIVE'
): Promise<NetworkV2Config> {
  const config = await updateNetworkV2Config({ status });
  console.log(`[NetworkV2] Status changed to: ${status}`);
  return config;
}

// ============================================================
// PROFILE OPERATIONS
// ============================================================

/**
 * Build or update a Network v2 profile for an account
 */
export async function buildNetworkV2Profile(
  accountId: string,
  handle: string
): Promise<NetworkV2Profile> {
  // Calculate authority
  const authority = await calculateAuthority(accountId);
  
  // Calculate elite exposure
  const eliteExposure = await calculateEliteExposure(accountId);
  
  // Calculate network influence (combined score)
  const networkInfluence = calculateNetworkInfluence(authority, eliteExposure);
  
  // Calculate network trust (consistency/reliability)
  const networkTrust = calculateNetworkTrust(authority, eliteExposure);
  
  // Smart-no-name score: high quality but low visibility
  const smartNoNameScore = calculateSmartNoNameScore(authority, eliteExposure);
  
  const profile: NetworkV2Profile = {
    account_id: accountId,
    handle,
    authority,
    elite_exposure: {
      account_id: accountId,
      ...eliteExposure,
    },
    inbound_connections: eliteExposure.total_followers,
    outbound_connections: 0, // Would need separate calculation
    high_value_connections: eliteExposure.elite_followers + eliteExposure.high_followers,
    network_influence: networkInfluence,
    network_trust: networkTrust,
    smart_no_name_score: smartNoNameScore,
    elite_paths: [], // Would need path calculation
    calculated_at: new Date().toISOString(),
    confidence: calculateConfidence(eliteExposure.total_followers),
  };
  
  // Store profile
  if (profilesCollection) {
    await profilesCollection.updateOne(
      { account_id: accountId },
      { $set: profile },
      { upsert: true }
    );
  }
  
  return profile;
}

/**
 * Get existing profile
 */
export async function getNetworkV2Profile(accountId: string): Promise<NetworkV2Profile | null> {
  if (!profilesCollection) return null;
  
  const doc = await profilesCollection.findOne({ account_id: accountId });
  return doc as NetworkV2Profile | null;
}

/**
 * Get top profiles by network influence
 */
export async function getTopProfiles(limit: number = 20): Promise<NetworkV2Profile[]> {
  if (!profilesCollection) return [];
  
  const profiles = await profilesCollection
    .find({})
    .sort({ network_influence: -1 })
    .limit(limit)
    .toArray();
  
  return profiles as NetworkV2Profile[];
}

/**
 * Get top smart-no-name accounts (hidden gems)
 */
export async function getSmartNoNames(limit: number = 20): Promise<NetworkV2Profile[]> {
  if (!profilesCollection) return [];
  
  const profiles = await profilesCollection
    .find({ smart_no_name_score: { $gt: 50 } })
    .sort({ smart_no_name_score: -1 })
    .limit(limit)
    .toArray();
  
  return profiles as NetworkV2Profile[];
}

// ============================================================
// SCORE CALCULATIONS
// ============================================================

function calculateNetworkInfluence(
  authority: AuthorityScore,
  eliteExposure: { exposure_score: number; total_followers: number }
): number {
  // Weight authority heavily, but elite exposure adds multiplier
  const baseScore = authority.score;
  const eliteMultiplier = 1 + (eliteExposure.exposure_score / 200);
  
  return Math.min(100, Math.round(baseScore * eliteMultiplier));
}

function calculateNetworkTrust(
  authority: AuthorityScore,
  eliteExposure: { elite_percentage: number; total_followers: number }
): number {
  // Trust is higher when elite % is meaningful AND absolute numbers are good
  const eliteFactor = Math.min(100, eliteExposure.elite_percentage * 2);
  const baseFactor = authority.based_on.followers_quality;
  
  return Math.round((eliteFactor * 0.6 + baseFactor * 0.4));
}

function calculateSmartNoNameScore(
  authority: AuthorityScore,
  eliteExposure: { elite_percentage: number; total_followers: number }
): number {
  // High score when:
  // - Good authority / elite exposure
  // - BUT low total followers (hidden gem)
  
  if (eliteExposure.total_followers > 10000) {
    // Not a "no-name" anymore
    return 0;
  }
  
  const qualityScore = (authority.score + eliteExposure.elite_percentage) / 2;
  
  // Inverse relationship with follower count
  const visibilityPenalty = Math.log10(eliteExposure.total_followers + 1) * 10;
  
  const smartNoNameScore = qualityScore - visibilityPenalty + 30; // +30 baseline
  
  return Math.max(0, Math.min(100, Math.round(smartNoNameScore)));
}

function calculateConfidence(dataPoints: number): number {
  // More data = more confidence
  if (dataPoints < 10) return 0.3;
  if (dataPoints < 50) return 0.5;
  if (dataPoints < 200) return 0.7;
  if (dataPoints < 1000) return 0.85;
  return 0.95;
}

// ============================================================
// BATCH PROCESSING
// ============================================================

/**
 * Process multiple accounts in batch
 */
export async function processBatch(
  accounts: { id: string; handle: string }[]
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  
  for (const account of accounts) {
    try {
      await buildNetworkV2Profile(account.id, account.handle);
      processed++;
    } catch (err) {
      console.error(`[NetworkV2] Error processing ${account.handle}:`, err);
      errors++;
    }
  }
  
  // Update config
  await updateNetworkV2Config({
    last_updated: new Date().toISOString(),
    accounts_processed: (await getNetworkV2Config()).accounts_processed + processed,
  });
  
  return { processed, errors };
}

// ============================================================
// STATISTICS
// ============================================================

export async function getNetworkV2Stats(): Promise<{
  config: NetworkV2Config;
  profiles_count: number;
  by_tier: Record<string, number>;
  smart_no_names: number;
  graph_stats: any;
}> {
  const config = await getNetworkV2Config();
  const graphStats = await getGraphStats();
  
  let profilesCount = 0;
  let smartNoNames = 0;
  const byTier: Record<string, number> = {};
  
  if (profilesCollection) {
    profilesCount = await profilesCollection.countDocuments();
    smartNoNames = await profilesCollection.countDocuments({ smart_no_name_score: { $gt: 50 } });
    
    // By tier
    const tierPipeline = [
      { $group: { _id: '$authority.tier', count: { $sum: 1 } } },
    ];
    const results = await profilesCollection.aggregate(tierPipeline).toArray();
    for (const r of results) byTier[r._id || 'UNKNOWN'] = r.count;
  }
  
  return {
    config,
    profiles_count: profilesCount,
    by_tier: byTier,
    smart_no_names: smartNoNames,
    graph_stats: graphStats,
  };
}

console.log('[NetworkV2] Authority Engine module loaded');
