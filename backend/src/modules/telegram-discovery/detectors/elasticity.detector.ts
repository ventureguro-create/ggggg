/**
 * Elasticity Detector
 * 
 * Checks if forwards follow views growth (elasticity curve)
 */
import { clamp01, quantile } from '../utils/math.js';

export interface ElasticityResult {
  elasticityScore: number;  // 0..1 (higher = worse/suspicious)
  lowQ: number;
  midQ: number;
  highQ: number;
}

export function detectElasticity(posts: Array<{ views?: number; forwards?: number }>): ElasticityResult {
  const items = posts
    .map(p => ({ v: p.views || 0, f: p.forwards || 0 }))
    .filter(x => x.v > 0);

  if (items.length < 12) return { elasticityScore: 0, lowQ: 0, midQ: 0, highQ: 0 };

  const vs = items.map(x => x.v);
  const q25 = quantile(vs, 0.25);
  const q75 = quantile(vs, 0.75);

  const low = items.filter(x => x.v <= q25);
  const mid = items.filter(x => x.v > q25 && x.v <= q75);
  const high = items.filter(x => x.v > q75);

  const rate = (arr: typeof items) => {
    const v = arr.reduce((s, x) => s + x.v, 0) / (arr.length || 1);
    const f = arr.reduce((s, x) => s + x.f, 0) / (arr.length || 1);
    return v > 0 ? f / v : 0;
  };

  const lowQ = rate(low);
  const midQ = rate(mid);
  const highQ = rate(high);

  // If highQ not higher than lowQ → suspicious
  const ratio = highQ > 0 ? (highQ / (lowQ || 1e-9)) : 0;

  const rel = clamp01((1.2 - ratio) / 1.2);
  const abs = clamp01((0.004 - highQ) / 0.004);

  const elasticityScore = clamp01(0.55 * rel + 0.45 * abs);

  return { elasticityScore, lowQ, midQ, highQ };
}
