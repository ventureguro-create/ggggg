/**
 * ML2 Predictions Store
 * Phase 5.3 — ML2 Shadow Enable
 * 
 * Stores full prediction records for later analysis and feedback linking
 */

import type { Db, Collection } from 'mongodb';
import type { Ml2Features, Ml2PredictionResult } from '../contracts/ml2.types.js';

const COLLECTION_NAME = 'connections_ml2_predictions';

let collection: Collection | null = null;

export interface Ml2PredictionRecord {
  alert_id: string;
  feature_hash: string;
  features: Ml2Features;
  rule_decision: string;
  ml2: Ml2PredictionResult;
  created_at: Date;
}

/**
 * Initialize predictions store
 */
export function initMl2PredictionsStore(db: Db): void {
  collection = db.collection(COLLECTION_NAME);
  
  // Create indexes
  collection.createIndex({ alert_id: 1 }, { unique: true });
  collection.createIndex({ feature_hash: 1 });
  collection.createIndex({ created_at: -1 });
  
  console.log('[ML2] Predictions store initialized');
}

/**
 * Save prediction record
 */
export async function savePrediction(record: Omit<Ml2PredictionRecord, 'created_at'>): Promise<void> {
  if (!collection) {
    console.warn('[ML2] Predictions store not initialized');
    return;
  }
  
  try {
    await collection.updateOne(
      { alert_id: record.alert_id },
      { 
        $set: {
          ...record,
          created_at: new Date(),
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error('[ML2] Failed to save prediction:', err);
  }
}

/**
 * Get prediction by alert ID
 */
export async function getPrediction(alertId: string): Promise<Ml2PredictionRecord | null> {
  if (!collection) return null;
  
  const doc = await collection.findOne({ alert_id: alertId });
  if (!doc) return null;
  
  return {
    alert_id: doc.alert_id,
    feature_hash: doc.feature_hash,
    features: doc.features,
    rule_decision: doc.rule_decision,
    ml2: doc.ml2,
    created_at: doc.created_at,
  };
}

/**
 * Get predictions by feature hash (for dataset building)
 */
export async function getPredictionsByHash(hashes: string[]): Promise<Ml2PredictionRecord[]> {
  if (!collection || hashes.length === 0) return [];
  
  const docs = await collection.find({ feature_hash: { $in: hashes } }).toArray();
  
  return docs.map(d => ({
    alert_id: d.alert_id,
    feature_hash: d.feature_hash,
    features: d.features,
    rule_decision: d.rule_decision,
    ml2: d.ml2,
    created_at: d.created_at,
  }));
}

console.log('[ML2] Predictions store module loaded');
