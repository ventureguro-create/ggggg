/**
 * ML2 Shadow Log Store
 * Phase 5.3 — ML2 Shadow Enable
 * 
 * Logs ML2 shadow predictions for comparison with rule decisions
 * This is the key data for evaluating ML2 before promotion
 */

import type { Db, Collection } from 'mongodb';
import type { Ml2ShadowLogEntry, Ml2Label, Ml2Recommendation, Ml2ShadowStats } from '../contracts/ml2.types.js';

const COLLECTION_NAME = 'connections_ml2_shadow_log';

let collection: Collection | null = null;

/**
 * Initialize shadow log store
 */
export function initMl2ShadowLogStore(db: Db): void {
  collection = db.collection(COLLECTION_NAME);
  
  // Create indexes
  collection.createIndex({ alert_id: 1 }, { unique: true });
  collection.createIndex({ ts: -1 });
  collection.createIndex({ would_change: 1, ts: -1 });
  
  console.log('[ML2] Shadow log store initialized');
}

/**
 * Log shadow prediction
 */
export async function logShadowPrediction(entry: Omit<Ml2ShadowLogEntry, 'ts'>): Promise<void> {
  if (!collection) {
    console.warn('[ML2] Shadow log store not initialized');
    return;
  }
  
  try {
    await collection.updateOne(
      { alert_id: entry.alert_id },
      { 
        $set: {
          ...entry,
          ts: new Date(),
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error('[ML2] Failed to log shadow prediction:', err);
  }
}

/**
 * Get shadow stats for admin dashboard
 */
export async function getShadowStats(windowDays: number = 7): Promise<Ml2ShadowStats> {
  if (!collection) {
    return {
      total: 0,
      agreement_rate: 0,
      would_suppress: 0,
      would_downrank: 0,
      noise_detected: 0,
      by_alert_type: {},
    };
  }
  
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  
  const docs = await collection.find({ ts: { $gte: since } }).toArray();
  
  if (docs.length === 0) {
    return {
      total: 0,
      agreement_rate: 1,
      would_suppress: 0,
      would_downrank: 0,
      noise_detected: 0,
      by_alert_type: {},
    };
  }
  
  const total = docs.length;
  const agreements = docs.filter(d => !d.would_change).length;
  const wouldSuppress = docs.filter(d => d.ml2_recommendation === 'SUPPRESS_SUGGEST').length;
  const wouldDownrank = docs.filter(d => d.ml2_recommendation === 'DOWNRANK').length;
  const noiseDetected = docs.filter(d => d.ml2_label === 'NOISE').length;
  
  // Group by alert type
  const byType: Record<string, { total: number; agreements: number }> = {};
  for (const doc of docs) {
    const type = doc.alert_type || 'UNKNOWN';
    if (!byType[type]) {
      byType[type] = { total: 0, agreements: 0 };
    }
    byType[type].total++;
    if (!doc.would_change) {
      byType[type].agreements++;
    }
  }
  
  const by_alert_type: Record<string, { total: number; agreement_rate: number }> = {};
  for (const [type, data] of Object.entries(byType)) {
    by_alert_type[type] = {
      total: data.total,
      agreement_rate: Math.round((data.agreements / data.total) * 100) / 100,
    };
  }
  
  return {
    total,
    agreement_rate: Math.round((agreements / total) * 100) / 100,
    would_suppress: Math.round((wouldSuppress / total) * 100) / 100,
    would_downrank: Math.round((wouldDownrank / total) * 100) / 100,
    noise_detected: Math.round((noiseDetected / total) * 100) / 100,
    by_alert_type,
  };
}

/**
 * Get recent shadow logs
 */
export async function getRecentShadowLogs(limit: number = 50): Promise<Ml2ShadowLogEntry[]> {
  if (!collection) {
    return [];
  }
  
  const docs = await collection
    .find({})
    .sort({ ts: -1 })
    .limit(limit)
    .toArray();
  
  return docs.map(d => ({
    alert_id: d.alert_id,
    ts: d.ts,
    rule_decision: d.rule_decision,
    ml2_prob: d.ml2_prob,
    ml2_label: d.ml2_label,
    ml2_recommendation: d.ml2_recommendation,
    would_change: d.would_change,
    change_type: d.change_type,
    note: d.note,
  }));
}

/**
 * Get disagreements only (where ML2 would have changed the decision)
 */
export async function getDisagreements(limit: number = 20): Promise<Ml2ShadowLogEntry[]> {
  if (!collection) {
    return [];
  }
  
  const docs = await collection
    .find({ would_change: true })
    .sort({ ts: -1 })
    .limit(limit)
    .toArray();
  
  return docs.map(d => ({
    alert_id: d.alert_id,
    ts: d.ts,
    rule_decision: d.rule_decision,
    ml2_prob: d.ml2_prob,
    ml2_label: d.ml2_label,
    ml2_recommendation: d.ml2_recommendation,
    would_change: d.would_change,
    change_type: d.change_type,
    note: d.note,
  }));
}

console.log('[ML2] Shadow log store module loaded');
