/**
 * Burst / Cluster Detector
 * 
 * Detects artificial view spikes and peak clusters
 */
import { clamp01, median } from '../utils/math.js';

export interface BurstResult {
  burstScore: number;          // 0..1
  peakClusterRatio: number;    // share of posts in peak clusters
  maxClusterLen: number;       // max length of consecutive peaks
}

export function detectBursts(posts: Array<{ date: Date; views?: number; forwards?: number }>): BurstResult {
  if (posts.length < 10) return { burstScore: 0, peakClusterRatio: 0, maxClusterLen: 0 };

  // Sort by time (old -> new)
  const sorted = [...posts].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const views = sorted.map(p => p.views || 0).filter(v => v > 0);
  const med = median(views) || 1;

  // Peak = 2.5x median
  const isPeak = sorted.map(p => ((p.views || 0) / med) >= 2.5);

  // Count consecutive peak clusters
  let peakPostsInClusters = 0;
  let maxClusterLen = 0;
  let cur = 0;

  for (let i = 0; i < isPeak.length; i++) {
    if (isPeak[i]) {
      cur++;
    } else {
      if (cur >= 2) {
        peakPostsInClusters += cur;
        maxClusterLen = Math.max(maxClusterLen, cur);
      }
      cur = 0;
    }
  }
  if (cur >= 2) {
    peakPostsInClusters += cur;
    maxClusterLen = Math.max(maxClusterLen, cur);
  }

  const peakClusterRatio = peakPostsInClusters / sorted.length;

  // Amplify if peak posts have weak forwards
  const peaks = sorted.filter((_, i) => isPeak[i]);
  const peakForwards = peaks.map(p => p.forwards || 0);
  const avgPeakFw = peakForwards.reduce((a, b) => a + b, 0) / (peakForwards.length || 1);

  const fwPenalty = avgPeakFw <= 1 ? 1 : avgPeakFw < 5 ? 0.7 : 0.4;

  const clusterScore = clamp01(peakClusterRatio / 0.25);
  const burstScore = clamp01(clusterScore * fwPenalty);

  return { burstScore, peakClusterRatio, maxClusterLen };
}
