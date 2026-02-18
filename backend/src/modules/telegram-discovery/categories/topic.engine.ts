/**
 * Topic Engine (Light TF-IDF-like)
 * 
 * Builds topic vectors for channels
 */
import { clamp01 } from '../utils/math.js';

export type TopicKey = 'trading' | 'nft' | 'early' | 'vc' | 'media' | 'macro' | 'security';

export type TopicVector = Record<TopicKey, number>;

const topicRules: Array<{ key: TopicKey; re: RegExp; w: number }> = [
  { key: 'trading', re: /\b(perps|futures|funding|long|short|liq(uidation)?|leverage|order\s*book)\b/gi, w: 2.0 },
  { key: 'trading', re: /\b(ta|chart|rsi|macd|support|resistance|setup|entry|exit)\b/gi, w: 1.2 },

  { key: 'nft', re: /\b(nft|mint|wl|whitelist|floor|collection|opensea|blur|rarity|traits)\b/gi, w: 2.0 },

  { key: 'early', re: /\b(airdrop|points|farm|quest|task|galxe|zealy|testnet|incentivized|restake|zk)\b/gi, w: 2.0 },
  { key: 'early', re: /\b(ido|ieo|launchpad|allocation|whitelist)\b/gi, w: 1.5 },

  { key: 'vc', re: /\b(vc|venture|fund|seed|series\s*[a-d]|round|valuation|portfolio|thesis)\b/gi, w: 2.0 },

  { key: 'media', re: /\b(news|breaking|digest|recap|weekly|daily|interview|podcast|report)\b/gi, w: 1.6 },

  { key: 'macro', re: /\b(cpi|fed|rates?|dxy|inflation|macro|yield|bond)\b/gi, w: 1.8 },

  { key: 'security', re: /\b(hack|exploit|rug|scam|phish|drain|security|audit)\b/gi, w: 1.8 },
];

export function buildTopicVector(texts: string[]): TopicVector {
  const doc = (texts.join('\n').slice(0, 50000) || '').toLowerCase();

  const raw: Record<string, number> = {};
  for (const r of topicRules) {
    const m = doc.match(r.re);
    if (!m?.length) continue;
    raw[r.key] = (raw[r.key] || 0) + r.w * Math.min(20, m.length);
  }

  const keys: TopicKey[] = ['trading', 'nft', 'early', 'vc', 'media', 'macro', 'security'];
  const max = Math.max(1e-9, ...keys.map(k => raw[k] || 0));

  const vec: TopicVector = {
    trading: clamp01((raw.trading || 0) / max),
    nft: clamp01((raw.nft || 0) / max),
    early: clamp01((raw.early || 0) / max),
    vc: clamp01((raw.vc || 0) / max),
    media: clamp01((raw.media || 0) / max),
    macro: clamp01((raw.macro || 0) / max),
    security: clamp01((raw.security || 0) / max),
  };
  return vec;
}

export function topTopics(vec: TopicVector, n = 3): Array<{ key: TopicKey; score: number }> {
  return Object.entries(vec)
    .map(([k, v]) => ({ key: k as TopicKey, score: Number(v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
