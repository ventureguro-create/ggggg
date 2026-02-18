/**
 * Source Diversity Detector
 * 
 * Detects network spillover / concentrated forward sources
 */
import { clamp01, normalizeUsername } from '../utils/math.js';

export interface SourceDiversityResult {
  forwardedTotal: number;
  uniqueSources: number;
  dominantSource: string | null;
  dominantSourceRatio: number;
  sourceHHI: number;           // 0..1 (1 = maximally concentrated)
  diversityScore: number;      // 0..1 (1 = diverse, 0 = single source)
  topSources: Array<{ source: string; count: number; share: number }>;
}

function extractSourceKey(fwd: any): string {
  if (!fwd) return '';
  const u = normalizeUsername(fwd.username || '');
  if (u) return u;
  if (fwd.id) return `id:${String(fwd.id)}`;
  return '';
}

export function detectSourceDiversity(posts: Array<{ forwardedFrom?: any }>): SourceDiversityResult {
  const counts = new Map<string, number>();
  let forwardedTotal = 0;

  for (const p of posts) {
    const key = extractSourceKey(p.forwardedFrom);
    if (!key) continue;
    forwardedTotal += 1;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const uniqueSources = counts.size;

  if (forwardedTotal === 0) {
    return {
      forwardedTotal: 0,
      uniqueSources: 0,
      dominantSource: null,
      dominantSourceRatio: 0,
      sourceHHI: 0,
      diversityScore: 1,
      topSources: [],
    };
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [dom, domCount] = entries[0];
  const dominantSourceRatio = domCount / forwardedTotal;

  // HHI = sum(share^2)
  let hhi = 0;
  const topSources = entries.slice(0, 10).map(([source, count]) => {
    const share = count / forwardedTotal;
    hhi += share * share;
    return { source, count, share };
  });

  // Full HHI for remaining sources
  if (entries.length > 10) {
    for (const [, count] of entries.slice(10)) {
      const share = count / forwardedTotal;
      hhi += share * share;
    }
  }

  const uniqueReward = clamp01(Math.log1p(uniqueSources) / Math.log1p(30));
  const concPenalty = clamp01(0.55 * dominantSourceRatio + 0.45 * hhi);
  const diversityScore = clamp01(0.15 + 0.85 * uniqueReward * (1 - concPenalty));

  return {
    forwardedTotal,
    uniqueSources,
    dominantSource: dom,
    dominantSourceRatio: clamp01(dominantSourceRatio),
    sourceHHI: clamp01(hhi),
    diversityScore,
    topSources,
  };
}
