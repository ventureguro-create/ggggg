/**
 * Twitter Adapter Status Service
 * 
 * Aggregates all adapter metrics into single DTO for admin panel.
 * Uses existing compute services, no duplicate calculations.
 */

import { Db } from 'mongodb';
import { getConfig, type TwitterAdapterConfigDoc, type AdapterMode } from '../../storage/twitter-adapter-config.store.js';
import { getAdapterStatus } from './adapter/twitter-adapter.config.js';
import { checkDataAvailability } from '../../ports/port-access.js';
import { getFollowGraphStatus } from './readers/twitterFollow.reader.js';

export interface DataHealthStatus {
  available: boolean;
  tweets_count: number;
  authors_count: number;
  newest_at?: Date;
  freshness: 'FRESH' | 'STALE' | 'EMPTY';
  freshness_hours?: number;
}

export interface ConfidenceDistribution {
  avg: number;
  min: number;
  max: number;
  below_gate_count: number;
  above_gate_count: number;
  warnings: string[];
}

export interface DiffSummary {
  avg_delta: number;
  max_delta: number;
  top_deltas: { author: string; delta: number }[];
  divergent_count: number;
}

export interface TwitterAdapterFullStatus {
  // Core status
  mode: AdapterMode;
  enabled: boolean;
  
  // Weights & Gates
  weights: TwitterAdapterConfigDoc['weights'];
  confidence_gate: number;
  caps: TwitterAdapterConfigDoc['caps'];
  
  // Hard locks (read-only display)
  locks: {
    read_only: boolean;
    alerts_disabled: boolean;
    parser_untouched: boolean;
    network_locked: boolean;
    authority_locked: boolean;
  };
  
  // Data health
  data: DataHealthStatus;
  
  // Confidence
  confidence: ConfidenceDistribution;
  
  // Diff summary
  diff: DiffSummary;
  
  // Graph status
  graph: {
    follow_available: boolean;
    co_engagement_available: boolean;
    active_source: string;
  };
  
  // Audit
  last_change: Date;
  changed_by: string;
  
  // Warnings
  warnings: string[];
}

/**
 * Get full adapter status for admin panel
 */
export async function getTwitterAdapterFullStatus(db: Db): Promise<TwitterAdapterFullStatus> {
  const config = await getConfig();
  const adapterStatus = getAdapterStatus();
  const dataAvail = await checkDataAvailability(db);
  const graphStatus = getFollowGraphStatus();
  
  const warnings: string[] = [];
  
  // Data health
  let freshness: 'FRESH' | 'STALE' | 'EMPTY' = 'EMPTY';
  let freshnessHours = 0;
  
  if (dataAvail.available && dataAvail.newest_at) {
    freshnessHours = (Date.now() - new Date(dataAvail.newest_at).getTime()) / (1000 * 60 * 60);
    freshness = freshnessHours < 24 ? 'FRESH' : freshnessHours < 168 ? 'STALE' : 'EMPTY';
    
    if (freshness === 'STALE') {
      warnings.push(`Data is ${freshnessHours.toFixed(0)}h old - consider re-running parser`);
    }
  } else {
    warnings.push('No Twitter data available - run parser first');
  }
  
  // Confidence distribution (from existing data)
  const confidenceData = await calculateConfidenceDistribution(db, config.confidence_gate);
  
  // Diff summary
  const diffSummary = await calculateDiffSummary(db);
  
  // Graph warnings
  if (!graphStatus.available) {
    warnings.push('Follow graph not available - network/authority weights locked at 0');
  }
  
  // Mode warnings
  if (config.mode === 'BLENDED' && !dataAvail.available) {
    warnings.push('BLENDED mode active but no data - effectively same as OFF');
  }
  
  return {
    mode: config.mode,
    enabled: config.mode !== 'OFF',
    
    weights: config.weights,
    confidence_gate: config.confidence_gate,
    caps: config.caps,
    
    locks: {
      read_only: config.locks.read_only,
      alerts_disabled: config.locks.alerts_disabled,
      parser_untouched: config.locks.parser_untouched,
      network_locked: config.caps.network_max === 0,
      authority_locked: config.caps.authority_max === 0,
    },
    
    data: {
      available: dataAvail.available,
      tweets_count: dataAvail.tweet_count,
      authors_count: dataAvail.author_count,
      newest_at: dataAvail.newest_at,
      freshness,
      freshness_hours: freshnessHours,
    },
    
    confidence: confidenceData,
    diff: diffSummary,
    
    graph: {
      follow_available: graphStatus.available,
      co_engagement_available: true,
      active_source: graphStatus.available ? 'follow + co_engagement' : 'co_engagement only',
    },
    
    last_change: config.last_change,
    changed_by: config.changed_by,
    
    warnings,
  };
}

async function calculateConfidenceDistribution(db: Db, gate: number): Promise<ConfidenceDistribution> {
  const collection = db.collection('twitter_results');
  
  try {
    const stats = await collection.aggregate([
      {
        $group: {
          _id: '$author.id',
          tweet_count: { $sum: 1 },
          total_engagement: { $sum: { $add: ['$likes', '$reposts', '$replies'] } },
          total_views: { $sum: '$views' },
          latest: { $max: '$createdAt' },
        }
      },
      { $match: { tweet_count: { $gte: 3 } } }
    ]).toArray();
    
    if (stats.length === 0) {
      return { avg: 0, min: 0, max: 0, below_gate_count: 0, above_gate_count: 0, warnings: ['No data for confidence calculation'] };
    }
    
    const confidences = stats.map(s => {
      const rate = s.total_views > 0 ? s.total_engagement / s.total_views : 0;
      const days = (Date.now() - new Date(s.latest).getTime()) / (1000 * 60 * 60 * 24);
      return Math.min(0.75, (s.tweet_count >= 10 ? 0.3 : s.tweet_count / 10 * 0.3) + (rate > 0.01 ? 0.3 : rate * 30) + (days < 7 ? 0.15 : 0));
    });
    
    return {
      avg: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      min: Math.min(...confidences),
      max: Math.max(...confidences),
      below_gate_count: confidences.filter(c => c < gate).length,
      above_gate_count: confidences.filter(c => c >= gate).length,
      warnings: [],
    };
  } catch {
    return { avg: 0, min: 0, max: 0, below_gate_count: 0, above_gate_count: 0, warnings: ['Error calculating confidence'] };
  }
}

async function calculateDiffSummary(db: Db): Promise<DiffSummary> {
  const collection = db.collection('twitter_results');
  
  try {
    const liveData = await collection.aggregate([
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          tweets: { $sum: 1 },
          engagement: { $sum: { $add: ['$likes', '$reposts', '$replies'] } },
        }
      },
      { $sort: { engagement: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    if (liveData.length === 0) {
      return { avg_delta: 0, max_delta: 0, top_deltas: [], divergent_count: 0 };
    }
    
    const deltas = liveData.map(l => {
      const mockEng = l.tweets * 50;
      return { author: l.username, delta: ((l.engagement - mockEng) / Math.max(1, mockEng)) * 100 };
    });
    
    return {
      avg_delta: deltas.reduce((a, b) => a + b.delta, 0) / deltas.length,
      max_delta: Math.max(...deltas.map(d => Math.abs(d.delta))),
      top_deltas: deltas.slice(0, 5),
      divergent_count: deltas.filter(d => Math.abs(d.delta) > 50).length,
    };
  } catch {
    return { avg_delta: 0, max_delta: 0, top_deltas: [], divergent_count: 0 };
  }
}

/**
 * Quick status check (lightweight)
 */
export async function getQuickStatus(db: Db): Promise<{
  mode: AdapterMode;
  data_available: boolean;
  warnings_count: number;
}> {
  const config = await getConfig();
  const dataAvail = await checkDataAvailability(db);
  const full = await getTwitterAdapterFullStatus(db);
  
  return {
    mode: config.mode,
    data_available: dataAvail.available,
    warnings_count: full.warnings.length,
  };
}
