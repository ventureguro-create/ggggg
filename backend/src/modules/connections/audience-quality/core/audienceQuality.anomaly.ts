/**
 * AQE Anomaly Detection
 * 
 * Detects follower growth anomalies:
 * - Growth spikes (sudden follower increase)
 * - Engagement flat (growth without engagement increase)
 * 
 * If both: anomaly = true (likely manipulation)
 */

import type { AQEConfig } from '../contracts/audienceQuality.config.js';
import type { AQEAnomaly } from '../contracts/audienceQuality.types.js';

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function std(xs: number[]): number {
  const m = mean(xs);
  const variance = mean(xs.map(x => (x - m) * (x - m)));
  return Math.sqrt(variance);
}

export function computeAnomaly(input: {
  followersSeries?: Array<{ ts: string; followers: number }>;
  engagementSeries?: Array<{ ts: string; engagement: number }>;
  cfg: AQEConfig;
}): AQEAnomaly {
  const notes: string[] = [];
  const fs = input.followersSeries?.slice(-30) ?? [];
  const es = input.engagementSeries?.slice(-30) ?? [];

  // Need at least 7 days of data
  if (fs.length < 7) {
    return { 
      growth_spike: false, 
      engagement_flat: false, 
      anomaly: false, 
      notes: ['INSUFFICIENT_DATA'] 
    };
  }

  // Calculate daily deltas
  const deltas: number[] = [];
  for (let i = 1; i < fs.length; i++) {
    deltas.push(fs[i].followers - fs[i - 1].followers);
  }

  const m = mean(deltas);
  const s = std(deltas) || 1;

  // Check for growth spike (z-score)
  const last = deltas[deltas.length - 1];
  const z = (last - m) / s;

  const growth_spike = z >= input.cfg.spike_z_threshold;
  if (growth_spike) {
    notes.push(`growth_spike_z=${z.toFixed(2)}`);
  }

  // Check for engagement flat
  let engagement_flat = false;
  if (es.length >= 7) {
    const e = es.map(x => x.engagement);
    const recentAvg = mean(e.slice(-7));
    const prevAvg = mean(e.slice(-14, -7));
    const eDelta = recentAvg - prevAvg;

    const growthSum = deltas.slice(-7).reduce((x, y) => x + y, 0);
    const ratio = Math.abs(eDelta) / Math.max(1, Math.abs(growthSum));
    
    engagement_flat = ratio <= input.cfg.engagement_flat_ratio_threshold;
    if (engagement_flat) {
      notes.push(`engagement_flat_ratio=${ratio.toFixed(2)}`);
    }
  } else {
    notes.push('NO_ENGAGEMENT_SERIES');
  }

  // Anomaly = growth spike AND engagement flat
  const anomaly = growth_spike && engagement_flat;
  if (anomaly) {
    notes.push('ANOMALY_DETECTED');
  }

  return { growth_spike, engagement_flat, anomaly, notes };
}
