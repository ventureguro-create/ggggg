/**
 * Authority Score Normalization
 * 
 * Supports: minmax, softmax, rank normalization
 */

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function normalizeScores(
  scores: Record<string, number>,
  method: 'minmax' | 'softmax' | 'rank',
  clamp: boolean
): Record<string, number> {
  const ids = Object.keys(scores);
  if (!ids.length) return scores;

  if (method === 'softmax') {
    // Stable softmax
    const vals = ids.map(id => scores[id]);
    const maxV = Math.max(...vals);
    const exps = vals.map(v => Math.exp(v - maxV));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    const out: Record<string, number> = {};
    ids.forEach((id, i) => {
      out[id] = exps[i] / sum;
    });
    return out;
  }

  if (method === 'rank') {
    // Rank-based normalization (1 for top, 0 for bottom)
    const sorted = ids.slice().sort((a, b) => scores[b] - scores[a]);
    const out: Record<string, number> = {};
    const n = sorted.length;
    sorted.forEach((id, i) => {
      const v = n === 1 ? 1 : 1 - (i / (n - 1));
      out[id] = clamp ? clamp01(v) : v;
    });
    return out;
  }

  // Default: minmax
  const vals = ids.map(id => scores[id]);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = (maxV - minV) || 1;

  const out: Record<string, number> = {};
  for (const id of ids) {
    const v = (scores[id] - minV) / span;
    out[id] = clamp ? clamp01(v) : v;
  }
  return out;
}

/**
 * Calculate percentile for a score within distribution
 */
export function calculatePercentile(
  score: number, 
  allScores: number[]
): number {
  if (allScores.length === 0) return 0;
  
  const below = allScores.filter(s => s < score).length;
  return (below / allScores.length) * 100;
}

/**
 * Calculate rank (1 = best)
 */
export function calculateRank(
  score: number,
  allScores: number[]
): number {
  const sorted = [...allScores].sort((a, b) => b - a);
  return sorted.indexOf(score) + 1;
}
