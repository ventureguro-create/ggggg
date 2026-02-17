/**
 * Co-Engagement Service - Network v2
 * 
 * Main service for co-engagement based network building
 */

import type { Db, Collection } from 'mongodb';
import type { CoEngagementConfig, CoEngagementResult } from './co-engagement.types.js';
import { DEFAULT_COENG_CONFIG } from './co-engagement.types.js';
import { buildActivityVectors } from './build-series.js';
import { buildCoEngagementNetwork, detectClusters } from './build-network.js';

const CONFIG_COLLECTION = 'connections_coeng_config';
const SNAPSHOT_COLLECTION = 'connections_coeng_snapshot';
const CONFIG_DOC_ID = 'coeng_config_v1';

let configCollection: Collection | null = null;
let snapshotCollection: Collection | null = null;
let db: Db | null = null;
let cachedConfig: CoEngagementConfig | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

export function initCoEngagementService(database: Db): void {
  db = database;
  configCollection = db.collection(CONFIG_COLLECTION);
  snapshotCollection = db.collection(SNAPSHOT_COLLECTION);
  
  // Create indexes
  snapshotCollection.createIndex({ computed_at: -1 }).catch(() => {});
  
  console.log('[CoEngagement] Service initialized');
}

// ============================================================
// CONFIG
// ============================================================

export async function getCoEngConfig(): Promise<CoEngagementConfig> {
  if (cachedConfig) return { ...cachedConfig };
  
  if (!configCollection) {
    return { ...DEFAULT_COENG_CONFIG };
  }
  
  const doc = await configCollection.findOne({ _id: CONFIG_DOC_ID as any });
  
  if (!doc) {
    await configCollection.insertOne({
      _id: CONFIG_DOC_ID as any,
      ...DEFAULT_COENG_CONFIG,
      created_at: new Date().toISOString(),
    });
    cachedConfig = { ...DEFAULT_COENG_CONFIG };
    return cachedConfig;
  }
  
  cachedConfig = { ...DEFAULT_COENG_CONFIG, ...doc };
  return { ...cachedConfig };
}

export async function updateCoEngConfig(
  updates: Partial<CoEngagementConfig>
): Promise<CoEngagementConfig> {
  if (!configCollection) throw new Error('CoEngagement not initialized');
  
  await configCollection.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $set: { ...updates, updated_at: new Date().toISOString() } },
    { upsert: true }
  );
  
  cachedConfig = null;
  return getCoEngConfig();
}

// ============================================================
// BUILD NETWORK
// ============================================================

/**
 * Build co-engagement network (dry run or save)
 */
export async function buildNetwork(opts?: {
  dry_run?: boolean;
  author_ids?: string[];
}): Promise<CoEngagementResult> {
  if (!db) throw new Error('CoEngagement not initialized');
  
  const cfg = await getCoEngConfig();
  
  // Step 1: Build activity vectors
  const vectors = await buildActivityVectors(db, cfg, { author_ids: opts?.author_ids });
  
  if (vectors.size === 0) {
    return {
      edges: [],
      nodes: [],
      stats: {
        total_nodes: 0,
        total_edges: 0,
        avg_similarity: 0,
        avg_confidence: 0,
        clusters_detected: 0,
        window_days: cfg.window_days,
        computed_at: new Date().toISOString(),
      },
    };
  }
  
  // Step 2: Build network
  const result = buildCoEngagementNetwork(vectors, cfg);
  
  // Step 3: Detect clusters
  const clusters = detectClusters(result.edges);
  const uniqueClusters = new Set(clusters.values());
  result.stats.clusters_detected = uniqueClusters.size;
  
  // Step 4: Save snapshot if not dry run
  if (!opts?.dry_run && snapshotCollection) {
    await snapshotCollection.insertOne({
      ...result,
      clusters: Object.fromEntries(clusters),
    });
    console.log(`[CoEngagement] Snapshot saved: ${result.stats.total_edges} edges, ${result.stats.clusters_detected} clusters`);
  }
  
  return result;
}

/**
 * Get latest snapshot
 */
export async function getLatestSnapshot(): Promise<CoEngagementResult | null> {
  if (!snapshotCollection) return null;
  
  const doc = await snapshotCollection.findOne(
    {},
    { sort: { computed_at: -1 } }
  );
  
  if (!doc) return null;
  
  return {
    edges: doc.edges || [],
    nodes: doc.nodes || [],
    stats: doc.stats || {},
  } as CoEngagementResult;
}

/**
 * Get network stats
 */
export async function getNetworkStats(): Promise<{
  has_data: boolean;
  latest_snapshot?: CoEngagementResult['stats'];
  config: CoEngagementConfig;
}> {
  const cfg = await getCoEngConfig();
  const snapshot = await getLatestSnapshot();
  
  return {
    has_data: !!snapshot,
    latest_snapshot: snapshot?.stats,
    config: cfg,
  };
}

console.log('[CoEngagement] Service module loaded');
