/**
 * ML2 Config Store
 * Phase 5.3 — ML2 Shadow Enable
 * 
 * Stores ML2 configuration in MongoDB
 */

import type { Db, Collection } from 'mongodb';
import type { Ml2Config, Ml2Mode } from '../contracts/ml2.types.js';
import { DEFAULT_ML2_CONFIG } from '../contracts/ml2.types.js';

const COLLECTION_NAME = 'connections_ml2_config';
const CONFIG_ID = 'ml2_main_config';

let collection: Collection | null = null;
let cachedConfig: Ml2Config | null = null;

/**
 * Initialize ML2 config store
 */
export function initMl2ConfigStore(db: Db): void {
  collection = db.collection(COLLECTION_NAME);
  console.log('[ML2] Config store initialized');
}

/**
 * Get current ML2 config
 */
export async function getMl2Config(): Promise<Ml2Config> {
  if (cachedConfig) return cachedConfig;
  
  if (!collection) {
    console.warn('[ML2] Config store not initialized, using defaults');
    return DEFAULT_ML2_CONFIG;
  }
  
  const doc = await collection.findOne({ _id: CONFIG_ID });
  
  if (!doc) {
    // Create default config
    await collection.insertOne({
      _id: CONFIG_ID as any,
      ...DEFAULT_ML2_CONFIG,
      created_at: new Date(),
      updated_at: new Date(),
    });
    cachedConfig = DEFAULT_ML2_CONFIG;
    return DEFAULT_ML2_CONFIG;
  }
  
  cachedConfig = {
    mode: doc.mode || DEFAULT_ML2_CONFIG.mode,
    min_prob_downrank: doc.min_prob_downrank ?? DEFAULT_ML2_CONFIG.min_prob_downrank,
    min_prob_suppress: doc.min_prob_suppress ?? DEFAULT_ML2_CONFIG.min_prob_suppress,
    model_version: doc.model_version || DEFAULT_ML2_CONFIG.model_version,
    enabled_alert_types: doc.enabled_alert_types || DEFAULT_ML2_CONFIG.enabled_alert_types,
  };
  
  return cachedConfig;
}

/**
 * Update ML2 config
 */
export async function updateMl2Config(updates: Partial<Ml2Config>): Promise<Ml2Config> {
  if (!collection) {
    throw new Error('ML2 config store not initialized');
  }
  
  // Validate mode
  if (updates.mode && !['OFF', 'SHADOW', 'ACTIVE_SAFE'].includes(updates.mode)) {
    throw new Error(`Invalid mode: ${updates.mode}`);
  }
  
  await collection.updateOne(
    { _id: CONFIG_ID },
    { 
      $set: { 
        ...updates, 
        updated_at: new Date() 
      } 
    },
    { upsert: true }
  );
  
  // Clear cache
  cachedConfig = null;
  
  console.log('[ML2] Config updated:', updates);
  return getMl2Config();
}

/**
 * Get current mode
 */
export async function getMl2Mode(): Promise<Ml2Mode> {
  const config = await getMl2Config();
  return config.mode;
}

console.log('[ML2] Config store module loaded');
