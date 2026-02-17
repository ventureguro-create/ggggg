/**
 * Twitter Adapter Config Store
 * 
 * Persistent storage for adapter configuration.
 * Stores: mode, weights, gates, caps, audit trail.
 */

import { Db, Collection } from 'mongodb';

const COLLECTION = 'connections_twitter_adapter_config';

export type AdapterMode = 'OFF' | 'READ_ONLY' | 'BLENDED';

export interface TwitterAdapterConfigDoc {
  _id?: string;
  config_id: 'main';  // Singleton
  
  // Mode
  mode: AdapterMode;
  
  // Weights (0-1)
  weights: {
    engagement: number;   // max 0.3
    trend: number;        // max 0.2
    network: number;      // 0 until follow graph
    authority: number;    // 0 until follow graph
  };
  
  // Gates
  confidence_gate: number;  // min confidence to blend (default 0.7)
  
  // Caps (system-enforced)
  caps: {
    confidence_max: number;     // 0.75 without follow graph
    engagement_max: number;     // 0.3
    trend_max: number;          // 0.2
    network_max: number;        // 0 (locked)
    authority_max: number;      // 0 (locked)
  };
  
  // Hard locks (never change via API)
  locks: {
    read_only: boolean;         // Always true
    alerts_disabled: boolean;   // True until T2.2+
    parser_untouched: boolean;  // Always true
  };
  
  // Audit
  last_change: Date;
  changed_by: string;
  change_reason?: string;
  
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_CONFIG: Omit<TwitterAdapterConfigDoc, '_id'> = {
  config_id: 'main',
  mode: 'OFF',
  weights: {
    engagement: 0,
    trend: 0,
    network: 0,
    authority: 0,
  },
  confidence_gate: 0.7,
  caps: {
    confidence_max: 0.75,
    engagement_max: 0.3,
    trend_max: 0.2,
    network_max: 0,
    authority_max: 0,
  },
  locks: {
    read_only: true,
    alerts_disabled: true,
    parser_untouched: true,
  },
  last_change: new Date(),
  changed_by: 'system',
  created_at: new Date(),
  updated_at: new Date(),
};

let collection: Collection<TwitterAdapterConfigDoc> | null = null;
let cachedConfig: TwitterAdapterConfigDoc | null = null;

export function initTwitterAdapterConfigStore(db: Db): void {
  collection = db.collection(COLLECTION);
  collection.createIndex({ config_id: 1 }, { unique: true });
  console.log('[TwitterAdapterConfigStore] Initialized');
}

export async function getConfig(): Promise<TwitterAdapterConfigDoc> {
  if (!collection) throw new Error('Store not initialized');
  
  if (cachedConfig) return { ...cachedConfig };
  
  let doc = await collection.findOne({ config_id: 'main' });
  
  if (!doc) {
    await collection.insertOne({ ...DEFAULT_CONFIG } as TwitterAdapterConfigDoc);
    doc = await collection.findOne({ config_id: 'main' });
  }
  
  cachedConfig = doc!;
  return { ...cachedConfig };
}

export async function updateConfig(
  updates: Partial<Pick<TwitterAdapterConfigDoc, 'mode' | 'weights' | 'confidence_gate'>>,
  changedBy: string,
  reason?: string
): Promise<TwitterAdapterConfigDoc> {
  if (!collection) throw new Error('Store not initialized');
  
  const current = await getConfig();
  
  // Apply updates with caps enforcement
  const newWeights = {
    engagement: Math.min(current.caps.engagement_max, Math.max(0, updates.weights?.engagement ?? current.weights.engagement)),
    trend: Math.min(current.caps.trend_max, Math.max(0, updates.weights?.trend ?? current.weights.trend)),
    network: 0,  // Locked
    authority: 0, // Locked
  };
  
  const newConfidenceGate = Math.max(0.5, Math.min(1, updates.confidence_gate ?? current.confidence_gate));
  
  await collection.updateOne(
    { config_id: 'main' },
    {
      $set: {
        mode: updates.mode ?? current.mode,
        weights: newWeights,
        confidence_gate: newConfidenceGate,
        last_change: new Date(),
        changed_by: changedBy,
        change_reason: reason,
        updated_at: new Date(),
      },
    }
  );
  
  cachedConfig = null;
  console.log(`[TwitterAdapterConfigStore] Config updated by ${changedBy}: mode=${updates.mode}, weights=`, newWeights);
  return getConfig();
}

export async function rollbackToSafe(changedBy: string): Promise<TwitterAdapterConfigDoc> {
  return updateConfig(
    { mode: 'OFF', weights: { engagement: 0, trend: 0, network: 0, authority: 0 } },
    changedBy,
    'Rollback to safe mode'
  );
}

export async function setMode(mode: AdapterMode, changedBy: string): Promise<TwitterAdapterConfigDoc> {
  return updateConfig({ mode }, changedBy, `Mode changed to ${mode}`);
}

export async function setWeights(
  weights: Partial<TwitterAdapterConfigDoc['weights']>,
  changedBy: string
): Promise<TwitterAdapterConfigDoc> {
  const current = await getConfig();
  return updateConfig(
    { weights: { ...current.weights, ...weights } },
    changedBy,
    'Weights updated'
  );
}
