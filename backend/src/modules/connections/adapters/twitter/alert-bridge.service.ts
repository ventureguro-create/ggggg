/**
 * Twitter Alert Bridge Service
 * 
 * Transforms twitter-derived signals into alert candidates.
 * Does NOT send alerts directly - passes to policy engine via port.
 */

import { Db } from 'mongodb';
import { emitAlertCandidate } from '../../ports/port-access.js';

// Local type definitions (decoupled from host alerts module)
export type AlertSource = 'twitter' | 'onchain' | 'exchange' | 'sentiment' | 'system';

export interface AlertCandidate {
  id: string;
  account_id?: string;
  symbol?: string;
  signal_type: string;
  source: AlertSource;
  confidence: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  headline: string;
  details?: string;
  metrics?: Record<string, any>;
  detected_at: Date;
}

export interface TwitterSignal {
  author_id: string;
  username: string;
  signal_type: 'ENGAGEMENT_SPIKE' | 'BREAKOUT' | 'PATTERN_CHANGE' | 'SMART_NO_NAME';
  confidence: number;
  metrics: {
    likes_delta?: number;
    reposts_delta?: number;
    views_delta?: number;
    engagement_rate?: number;
  };
  pattern?: string;
  detected_at: Date;
}

export interface BridgeResult {
  success: boolean;
  candidate?: AlertCandidate;
  skipped_reason?: string;
}

/**
 * Transform Twitter signal to alert candidate
 */
export function transformSignalToCandidate(signal: TwitterSignal): AlertCandidate {
  return {
    id: `tw_alert_${signal.author_id}_${Date.now()}`,
    account_id: signal.author_id,
    signal_type: signal.signal_type,
    source: 'twitter' as AlertSource,
    confidence: signal.confidence,
    context: {
      diff_delta: signal.metrics.engagement_rate,
      pattern: signal.pattern,
      ml2_score: undefined, // Will be filled by policy engine
      aqm_level: undefined, // Will be filled by policy engine
    },
    created_at: signal.detected_at,
  };
}

/**
 * Detect signals from twitter data (read-only)
 */
export async function detectTwitterSignals(db: Db): Promise<TwitterSignal[]> {
  const signals: TwitterSignal[] = [];
  const collection = db.collection('twitter_results');
  
  try {
    // Detect engagement spikes
    const spikes = await collection.aggregate([
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          tweet_count: { $sum: 1 },
          total_likes: { $sum: '$likes' },
          max_likes: { $max: '$likes' },
          avg_likes: { $avg: '$likes' },
          total_views: { $sum: '$views' },
        }
      },
      {
        $match: {
          tweet_count: { $gte: 5 },
          $expr: { $gt: ['$max_likes', { $multiply: ['$avg_likes', 5] }] } // 5x spike
        }
      }
    ]).toArray();

    for (const spike of spikes) {
      const engagementRate = spike.total_views > 0 ? spike.total_likes / spike.total_views : 0;
      const confidence = Math.min(0.75, 0.5 + engagementRate * 2);
      
      signals.push({
        author_id: spike._id,
        username: spike.username,
        signal_type: 'ENGAGEMENT_SPIKE',
        confidence,
        metrics: {
          likes_delta: spike.max_likes - spike.avg_likes,
          engagement_rate: engagementRate,
        },
        pattern: spike.max_likes > 5000 ? 'BREAKOUT' : 'SPIKE',
        detected_at: new Date(),
      });
    }

    // Detect smart no-name (low followers, high engagement)
    const smartNoNames = await collection.aggregate([
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          followers: { $first: '$author.followers' },
          tweet_count: { $sum: 1 },
          total_reposts: { $sum: '$reposts' },
          total_likes: { $sum: '$likes' },
        }
      },
      {
        $match: {
          followers: { $lt: 2000 },
          tweet_count: { $gte: 3 },
          $expr: { $gt: [{ $divide: ['$total_reposts', { $max: ['$total_likes', 1] }] }, 0.3] }
        }
      }
    ]).toArray();

    for (const snn of smartNoNames) {
      const repostRatio = snn.total_likes > 0 ? snn.total_reposts / snn.total_likes : 0;
      
      signals.push({
        author_id: snn._id,
        username: snn.username,
        signal_type: 'SMART_NO_NAME',
        confidence: Math.min(0.75, 0.6 + repostRatio * 0.3),
        metrics: {
          reposts_delta: snn.total_reposts,
          engagement_rate: repostRatio,
        },
        pattern: 'SMART_NO_NAME',
        detected_at: new Date(),
      });
    }

    console.log(`[AlertBridge] Detected ${signals.length} signals from twitter data`);
  } catch (err: any) {
    console.error('[AlertBridge] Error detecting signals:', err.message);
  }

  return signals;
}

/**
 * Bridge signals to alert candidates (batch)
 */
export async function bridgeSignals(db: Db): Promise<{ candidates: AlertCandidate[]; skipped: number }> {
  const signals = await detectTwitterSignals(db);
  const candidates: AlertCandidate[] = [];
  let skipped = 0;

  for (const signal of signals) {
    if (signal.confidence < 0.5) {
      skipped++;
      continue;
    }
    candidates.push(transformSignalToCandidate(signal));
  }

  return { candidates, skipped };
}
