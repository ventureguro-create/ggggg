/**
 * Promo Network Detector
 * 
 * Detects promotional patterns and "links block" signatures
 */
import { clamp01 } from '../utils/math.js';

export interface PromoResult {
  promoDensity: number;      // mentions per post
  linkBlockRatio: number;    // share of posts with "links block"
  promoScore: number;        // 0..1 (higher = more promotional)
}

const LINKS_BLOCK_RE = /(подписывайтес|партнер|друзья|каналы|our\s+friends|partners|subscribe).{0,120}(t\.me\/|@)/i;

export function detectPromo(posts: Array<{ text?: string; mentions?: string[] }>): PromoResult {
  if (!posts.length) return { promoDensity: 0, linkBlockRatio: 0, promoScore: 0 };

  const mentionsCount = posts.reduce((s, p) => s + (p.mentions?.length || 0), 0);
  const promoDensity = mentionsCount / posts.length;

  const withBlock = posts.filter((p) => LINKS_BLOCK_RE.test(p.text || '')).length;
  const linkBlockRatio = withBlock / posts.length;

  const densityScore = clamp01(promoDensity / 6);
  const blockScore = clamp01(linkBlockRatio / 0.35);

  const promoScore = clamp01(0.65 * densityScore + 0.35 * blockScore);

  return { promoDensity, linkBlockRatio, promoScore };
}
