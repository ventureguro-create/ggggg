/**
 * Originality Detector
 * 
 * Detects copy-paste feeds
 */
import { clamp01 } from '../utils/math.js';

export interface OriginalityResult {
  duplicateRatio: number;     // 0..1
  originalityScore: number;   // 0..1 (1 = very original, 0 = copy-paste)
}

function normalizeText(t: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/t\.me\/\S+/g, ' ')
    .replace(/[@$#]\w+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(t: string): string {
  const n = normalizeText(t);
  if (!n) return '';
  const tokens = n.split(' ').filter(w => w.length >= 4).slice(0, 60);
  return tokens.sort().join('|');
}

export function detectOriginality(posts: Array<{ text?: string }>): OriginalityResult {
  const texts = posts.map(p => p.text || '').filter(t => t.length >= 20);
  if (texts.length < 10) return { duplicateRatio: 0, originalityScore: 1 };

  const fp = texts.map(fingerprint).filter(Boolean);
  const seen = new Map<string, number>();

  for (const f of fp) seen.set(f, (seen.get(f) || 0) + 1);

  const duplicates = [...seen.values()].filter(v => v >= 2).reduce((s, v) => s + v, 0);
  const duplicateRatio = clamp01(duplicates / fp.length);

  const originalityScore = clamp01(1 - duplicateRatio);

  return { duplicateRatio, originalityScore };
}
