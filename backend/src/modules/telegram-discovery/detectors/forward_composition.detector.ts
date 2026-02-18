/**
 * Forward Composition Detector
 * 
 * Detects aggregator/repost-feed channels
 */
import { clamp01 } from '../utils/math.js';

export interface ForwardCompResult {
  forwardedPostRatio: number;   // 0..1
  forwardedViewsRatio: number;  // 0..1
  repostinessScore: number;     // 0..1 (higher = more aggregator)
}

export function detectForwardComposition(posts: Array<{ forwardedFrom?: any; views?: number }>): ForwardCompResult {
  if (!posts.length) return { forwardedPostRatio: 0, forwardedViewsRatio: 0, repostinessScore: 0 };

  const total = posts.length;
  const fPosts = posts.filter(p => !!p.forwardedFrom).length;

  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const fViews = posts.reduce((s, p) => s + (p.forwardedFrom ? (p.views || 0) : 0), 0);

  const forwardedPostRatio = clamp01(fPosts / total);
  const forwardedViewsRatio = totalViews > 0 ? clamp01(fViews / totalViews) : 0;

  const repostinessScore = clamp01(0.55 * forwardedPostRatio + 0.45 * forwardedViewsRatio);

  return { forwardedPostRatio, forwardedViewsRatio, repostinessScore };
}
