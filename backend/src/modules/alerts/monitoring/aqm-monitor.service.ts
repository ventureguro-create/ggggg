/**
 * AQM Monitor Service - T2.4
 * Monitors Alert Quality Metrics. NO IMPACT on decisions.
 */

import { Db, Collection } from 'mongodb';

const COLLECTION = 'connections_aqm_metrics';

export interface AQMMetrics {
  timestamp: Date;
  period: string;
  distribution: { high: number; medium: number; low: number };
  send_rate: number;
  suppress_rate: number;
  block_rate: number;
  confidence_avg: number;
  network_support_pct: number;
  isolated_spike_pct: number;
  total_candidates: number;
  total_sent: number;
  total_suppressed: number;
  total_blocked: number;
}

let collection: Collection<AQMMetrics> | null = null;

export function initAQMMonitor(db: Db): void {
  collection = db.collection(COLLECTION);
  collection.createIndex({ timestamp: -1 });
  console.log('[AQMMonitor] Initialized');
}

export async function recordMetrics(metrics: Omit<AQMMetrics, 'timestamp'>): Promise<void> {
  if (!collection) return;
  await collection.insertOne({ ...metrics, timestamp: new Date() } as AQMMetrics);
}

export async function getLatestMetrics(period: string = 'hourly'): Promise<AQMMetrics | null> {
  if (!collection) return null;
  return collection.findOne({ period }, { sort: { timestamp: -1 } });
}

export async function calculateCurrentAQM(db: Db): Promise<AQMMetrics> {
  const auditCollection = db.collection('connections_alert_audit');
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const decisions = await auditCollection.find({ created_at: { $gte: since } }).toArray();
  
  const total = decisions.length;
  const sent = decisions.filter(d => d.decision === 'SEND').length;
  const suppressed = decisions.filter(d => d.decision === 'SUPPRESS').length;
  const blocked = decisions.filter(d => d.decision === 'BLOCK').length;
  const confidences = decisions.map(d => d.confidence || 0);
  
  return {
    timestamp: new Date(),
    period: 'hourly',
    distribution: {
      high: total > 0 ? confidences.filter(c => c >= 0.8).length / total : 0,
      medium: total > 0 ? confidences.filter(c => c >= 0.7 && c < 0.8).length / total : 0,
      low: total > 0 ? confidences.filter(c => c < 0.7).length / total : 0,
    },
    send_rate: total > 0 ? sent / total : 0,
    suppress_rate: total > 0 ? suppressed / total : 0,
    block_rate: total > 0 ? blocked / total : 0,
    confidence_avg: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
    network_support_pct: 0,
    isolated_spike_pct: 0,
    total_candidates: total,
    total_sent: sent,
    total_suppressed: suppressed,
    total_blocked: blocked,
  };
}

export function checkAQMHealth(metrics: AQMMetrics): { healthy: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (metrics.suppress_rate > 0.8) warnings.push('High suppress rate (>80%)');
  if (metrics.distribution.low > 0.5) warnings.push('Majority low confidence');
  return { healthy: warnings.length === 0, warnings };
}
