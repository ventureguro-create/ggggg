/**
 * Alert Enrichment Service - T2.4
 * 
 * Enriches alerts with contextual flags.
 * Does NOT create new alert types.
 */

import { Db } from 'mongodb';
import type { AlertCandidate } from './alert-policy.engine.js';
import { buildNetworkGraph } from '../connections/network/network-adapter.service.js';

export type AlertFlag = 
  | 'NETWORK_SUPPORTED'      // Has strong co-engagement edges
  | 'NETWORK_WEAK'           // Low/no network support
  | 'ISOLATED_SPIKE'         // Spike without network context
  | 'SMART_CLUSTER_CONFIRMED'// Part of smart-no-name cluster
  | 'BOT_CLUSTER_WARNING'    // Connected to bot-like accounts
  | 'HIGH_CONFIDENCE'        // Confidence ≥ 80%
  | 'MEDIUM_CONFIDENCE'      // Confidence 70-80%
  | 'FRESH_DATA'             // Data < 24h old
  | 'STALE_DATA';            // Data > 72h old

export interface EnrichedAlert extends AlertCandidate {
  flags: AlertFlag[];
  enrichment: {
    network_score: number;      // 0-1
    cluster_type?: string;      // normal / smart / bot
    connected_accounts: number;
    data_freshness_hours: number;
  };
}

/**
 * Enrich alert candidate with contextual flags
 */
export async function enrichAlert(
  db: Db,
  candidate: AlertCandidate
): Promise<EnrichedAlert> {
  const flags: AlertFlag[] = [];
  const enrichment = {
    network_score: 0,
    cluster_type: undefined as string | undefined,
    connected_accounts: 0,
    data_freshness_hours: 0,
  };

  try {
    // Get network graph
    const graph = await buildNetworkGraph(db);
    
    // Find edges connected to this account
    const connectedEdges = graph.edges.filter(
      e => e.from_id === candidate.account_id || e.to_id === candidate.account_id
    );
    
    enrichment.connected_accounts = connectedEdges.length;
    
    if (connectedEdges.length > 0) {
      // Calculate network score (avg weight of connections)
      enrichment.network_score = connectedEdges.reduce((s, e) => s + e.weight, 0) / connectedEdges.length;
      
      if (enrichment.network_score >= 0.7) {
        flags.push('NETWORK_SUPPORTED');
      } else if (enrichment.network_score < 0.3) {
        flags.push('NETWORK_WEAK');
      }
    } else {
      flags.push('NETWORK_WEAK');
      
      // Check if it's an isolated spike
      if (candidate.signal_type === 'ENGAGEMENT_SPIKE') {
        flags.push('ISOLATED_SPIKE');
      }
    }

    // Detect cluster type based on connected accounts
    const connectedIds = new Set<string>();
    for (const edge of connectedEdges) {
      connectedIds.add(edge.from_id);
      connectedIds.add(edge.to_id);
    }
    
    // Check for smart no-name cluster
    const smartPattern = Array.from(connectedIds).filter(id => id.startsWith('sn_')).length;
    const botPattern = Array.from(connectedIds).filter(id => id.startsWith('bt_')).length;
    
    if (smartPattern > 0 && candidate.account_id.startsWith('sn_')) {
      flags.push('SMART_CLUSTER_CONFIRMED');
      enrichment.cluster_type = 'smart';
    } else if (botPattern > 0) {
      flags.push('BOT_CLUSTER_WARNING');
      enrichment.cluster_type = 'bot';
    } else {
      enrichment.cluster_type = 'normal';
    }

    // Confidence flags
    if (candidate.confidence >= 0.8) {
      flags.push('HIGH_CONFIDENCE');
    } else if (candidate.confidence >= 0.7) {
      flags.push('MEDIUM_CONFIDENCE');
    }

    // Data freshness (from context if available)
    const freshnessHours = candidate.context.diff_delta 
      ? Math.abs(candidate.context.diff_delta) * 100 // Rough estimate
      : 24;
    enrichment.data_freshness_hours = freshnessHours;
    
    if (freshnessHours < 24) {
      flags.push('FRESH_DATA');
    } else if (freshnessHours > 72) {
      flags.push('STALE_DATA');
    }

  } catch (err: any) {
    console.error('[AlertEnrichment] Error:', err.message);
  }

  return {
    ...candidate,
    flags,
    enrichment,
  };
}

/**
 * Enrich multiple alerts
 */
export async function enrichAlerts(
  db: Db,
  candidates: AlertCandidate[]
): Promise<EnrichedAlert[]> {
  const enriched: EnrichedAlert[] = [];
  
  for (const candidate of candidates) {
    enriched.push(await enrichAlert(db, candidate));
  }
  
  return enriched;
}

/**
 * Get flag explanation for Telegram
 */
export function getFlagExplanation(flag: AlertFlag): string {
  const explanations: Record<AlertFlag, string> = {
    'NETWORK_SUPPORTED': '🔗 Strong network connections',
    'NETWORK_WEAK': '⚠️ Weak/no network support',
    'ISOLATED_SPIKE': '🔺 Isolated spike (no context)',
    'SMART_CLUSTER_CONFIRMED': '🧠 Part of smart cluster',
    'BOT_CLUSTER_WARNING': '🤖 Connected to bot-like accounts',
    'HIGH_CONFIDENCE': '✅ High confidence (≥80%)',
    'MEDIUM_CONFIDENCE': '🟡 Medium confidence (70-80%)',
    'FRESH_DATA': '🆕 Fresh data (<24h)',
    'STALE_DATA': '⏳ Stale data (>72h)',
  };
  return explanations[flag] || flag;
}
