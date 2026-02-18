/**
 * Utility functions
 */
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(arr: number[], q: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(q * (s.length - 1));
  return s[idx];
}

export function variance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

export function shannonEntropy(arr: number[]): number {
  if (!arr.length) return 0;
  const total = arr.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const probs = arr.map((v) => v / total);
  return -probs.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
}

export function normalizeUsername(x: string): string {
  const s = (x || '').trim();
  const noAt = s.startsWith('@') ? s.slice(1) : s;
  const noTme = noAt.replace(/^https?:\/\/t\.me\//i, '').replace(/^t\.me\//i, '');
  return noTme.split(/[/?#]/)[0].toLowerCase();
}

export function logNorm(x: number, max = 2000000): number {
  return clamp01(Math.log1p(x) / Math.log1p(max));
}

export function bayesianAverage(value: number, count: number, prior = 0.5, weight = 10): number {
  return (value * count + prior * weight) / (count + weight);
}
