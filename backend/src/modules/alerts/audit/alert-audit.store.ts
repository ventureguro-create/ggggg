/**
 * Alert Audit Store
 * 
 * Logs every alert decision for debugging and compliance.
 */

import { Db, Collection } from 'mongodb';
import type { AlertDecision, SuppressionReason, AlertSource } from '../alert-policy.engine.js';

const COLLECTION = 'connections_alert_audit';

export interface AuditEntry {
  _id?: string;
  alert_id: string;
  account_id: string;
  signal_type: string;
  source: AlertSource;
  decision: AlertDecision;
  suppression_reason?: SuppressionReason;
  confidence: number;
  gates_passed: Record<string, boolean>;
  pilot_step?: string;
  context?: Record<string, any>;
  created_at: Date;
}

let collection: Collection<AuditEntry> | null = null;

export function initAuditStore(db: Db): void {
  collection = db.collection(COLLECTION);
  collection.createIndex({ created_at: -1 });
  collection.createIndex({ account_id: 1, created_at: -1 });
  collection.createIndex({ decision: 1, created_at: -1 });
  collection.createIndex({ suppression_reason: 1 });
  console.log('[AlertAuditStore] Initialized');
}

export async function logDecision(entry: Omit<AuditEntry, '_id' | 'created_at'>): Promise<void> {
  if (!collection) return;
  
  await collection.insertOne({
    ...entry,
    created_at: new Date(),
  } as AuditEntry);
}

export async function getRecentDecisions(
  limit: number = 50,
  filter?: { decision?: AlertDecision; source?: AlertSource }
): Promise<AuditEntry[]> {
  if (!collection) return [];
  
  const query: any = {};
  if (filter?.decision) query.decision = filter.decision;
  if (filter?.source) query.source = filter.source;
  
  return collection.find(query).sort({ created_at: -1 }).limit(limit).toArray();
}

export async function getSuppressionStats(): Promise<Record<string, number>> {
  if (!collection) return {};
  
  const stats = await collection.aggregate([
    { $match: { decision: { $in: ['SUPPRESS', 'BLOCK'] } } },
    { $group: { _id: '$suppression_reason', count: { $sum: 1 } } },
  ]).toArray();
  
  return stats.reduce((acc, s) => {
    acc[s._id || 'UNKNOWN'] = s.count;
    return acc;
  }, {} as Record<string, number>);
}

export async function getDecisionCounts(since?: Date): Promise<{
  sent: number;
  suppressed: number;
  blocked: number;
}> {
  if (!collection) return { sent: 0, suppressed: 0, blocked: 0 };
  
  const match: any = {};
  if (since) match.created_at = { $gte: since };
  
  const counts = await collection.aggregate([
    { $match: match },
    { $group: { _id: '$decision', count: { $sum: 1 } } },
  ]).toArray();
  
  return {
    sent: counts.find(c => c._id === 'SEND')?.count || 0,
    suppressed: counts.find(c => c._id === 'SUPPRESS')?.count || 0,
    blocked: counts.find(c => c._id === 'BLOCK')?.count || 0,
  };
}

export async function getAuditByAccount(accountId: string, limit: number = 20): Promise<AuditEntry[]> {
  if (!collection) return [];
  return collection.find({ account_id: accountId }).sort({ created_at: -1 }).limit(limit).toArray();
}
