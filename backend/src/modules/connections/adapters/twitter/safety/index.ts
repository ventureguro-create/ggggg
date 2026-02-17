/**
 * Safety Layer
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 * 
 * Guards against bad data:
 * - Duplicates (dedup)
 * - Stale data (freshness)
 * - Anomalies (spikes, bots)
 */

export * from './dedup.guard.js';
export * from './anomaly.guard.js';
export * from './freshness.guard.js';
