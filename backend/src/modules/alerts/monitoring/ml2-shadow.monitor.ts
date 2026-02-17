/**
 * ML2 Shadow Monitor - T2.4
 * 
 * Tracks ML2 shadow predictions vs rule decisions.
 * ML2 does NOT affect decisions - observation only.
 */

import { Db, Collection } from 'mongodb';

const COLLECTION = 'connections_ml2_shadow_log';

export interface ML2ShadowEntry {
  timestamp: Date;
  alert_id: string;
  account_id: string;
  
  // Rule decision
  rule_decision: 'SEND' | 'SUPPRESS' | 'BLOCK';
  rule_confidence: number;
  
  // ML2 shadow prediction
  ml2_prediction: 'SEND' | 'SUPPRESS';
  ml2_confidence: number;
  
  // Agreement
  agrees: boolean;
  disagreement_reason?: string;
}

export interface ML2ShadowStats {
  total_evaluated: number;
  agreement_rate: number;
  disagreement_rate: number;
  
  // Breakdown
  rule_send_ml2_send: number;
  rule_send_ml2_suppress: number;
  rule_suppress_ml2_send: number;
  rule_suppress_ml2_suppress: number;
  
  // False positive hints
  potential_fp_count: number;  // Rule SEND but ML2 SUPPRESS
  potential_fn_count: number;  // Rule SUPPRESS but ML2 SEND
}

let collection: Collection<ML2ShadowEntry> | null = null;

export function initML2ShadowMonitor(db: Db): void {
  collection = db.collection(COLLECTION);
  collection.createIndex({ timestamp: -1 });
  collection.createIndex({ account_id: 1 });
  collection.createIndex({ agrees: 1 });
  console.log('[ML2Shadow] Monitor initialized');
}

export async function logShadowPrediction(entry: Omit<ML2ShadowEntry, 'timestamp'>): Promise<void> {
  if (!collection) return;
  await collection.insertOne({ ...entry, timestamp: new Date() } as ML2ShadowEntry);
}

export async function getShadowStats(since?: Date): Promise<ML2ShadowStats> {
  if (!collection) {
    return {
      total_evaluated: 0,
      agreement_rate: 0,
      disagreement_rate: 0,
      rule_send_ml2_send: 0,
      rule_send_ml2_suppress: 0,
      rule_suppress_ml2_send: 0,
      rule_suppress_ml2_suppress: 0,
      potential_fp_count: 0,
      potential_fn_count: 0,
    };
  }

  const match = since ? { timestamp: { $gte: since } } : {};
  const entries = await collection.find(match).toArray();
  
  const total = entries.length;
  if (total === 0) {
    return {
      total_evaluated: 0,
      agreement_rate: 0,
      disagreement_rate: 0,
      rule_send_ml2_send: 0,
      rule_send_ml2_suppress: 0,
      rule_suppress_ml2_send: 0,
      rule_suppress_ml2_suppress: 0,
      potential_fp_count: 0,
      potential_fn_count: 0,
    };
  }

  const agrees = entries.filter(e => e.agrees).length;
  const ruleSendMl2Send = entries.filter(e => e.rule_decision === 'SEND' && e.ml2_prediction === 'SEND').length;
  const ruleSendMl2Suppress = entries.filter(e => e.rule_decision === 'SEND' && e.ml2_prediction === 'SUPPRESS').length;
  const ruleSuppressMl2Send = entries.filter(e => e.rule_decision === 'SUPPRESS' && e.ml2_prediction === 'SEND').length;
  const ruleSuppressMl2Suppress = entries.filter(e => e.rule_decision === 'SUPPRESS' && e.ml2_prediction === 'SUPPRESS').length;

  return {
    total_evaluated: total,
    agreement_rate: agrees / total,
    disagreement_rate: (total - agrees) / total,
    rule_send_ml2_send: ruleSendMl2Send,
    rule_send_ml2_suppress: ruleSendMl2Suppress,
    rule_suppress_ml2_send: ruleSuppressMl2Send,
    rule_suppress_ml2_suppress: ruleSuppressMl2Suppress,
    potential_fp_count: ruleSendMl2Suppress,  // Rule says SEND but ML2 says SUPPRESS
    potential_fn_count: ruleSuppressMl2Send,  // Rule says SUPPRESS but ML2 says SEND
  };
}

/**
 * Simulate ML2 prediction (placeholder - actual ML2 would be more sophisticated)
 */
export function simulateML2Prediction(context: {
  confidence: number;
  networkScore: number;
  pattern?: string;
}): { prediction: 'SEND' | 'SUPPRESS'; confidence: number } {
  // Simple heuristic for shadow mode
  // Real ML2 would use trained model
  
  let score = context.confidence;
  
  // Network boost
  if (context.networkScore > 0.7) score += 0.1;
  if (context.networkScore < 0.3) score -= 0.1;
  
  // Pattern adjustment
  if (context.pattern === 'SMART_NO_NAME') score += 0.05;
  if (context.pattern === 'BOT_SUSPECTED') score -= 0.15;
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    prediction: score >= 0.65 ? 'SEND' : 'SUPPRESS',
    confidence: score,
  };
}
