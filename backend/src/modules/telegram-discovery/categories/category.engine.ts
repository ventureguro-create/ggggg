/**
 * Category Engine
 * 
 * Rules-based channel classification
 */
import { clamp01 } from '../utils/math.js';

export type CatKey = 'TRADING' | 'MEDIA' | 'NFT' | 'EARLY' | 'VC' | 'POPULAR' | 'INFLUENCE';

export type CategoryMatch = { category: CatKey; confidence: number; hits: string[] };

const rules: Array<{
  category: CatKey;
  keywords: Array<{ re: RegExp; w: number; tag: string }>;
  entities?: Array<{ re: RegExp; w: number; tag: string }>;
}> = [
  {
    category: 'TRADING',
    keywords: [
      { re: /\b(perps|futures|funding|order\s*book|long|short|liq(uidation)?|leverage)\b/i, w: 2.0, tag: 'derivatives' },
      { re: /\b(alpha|signal|entry|exit|tp\d|sl|setup)\b/i, w: 1.6, tag: 'signals' },
      { re: /\b(technical|ta|chart|support|resistance|rsi|macd)\b/i, w: 1.2, tag: 'ta' },
    ],
    entities: [{ re: /\$[A-Z]{2,10}\b/g, w: 0.6, tag: 'tickers' }],
  },
  {
    category: 'MEDIA',
    keywords: [
      { re: /\b(news|breaking|update|digest|recap|weekly|daily)\b/i, w: 1.6, tag: 'news' },
      { re: /\b(interview|podcast|thread|analysis|report)\b/i, w: 1.2, tag: 'formats' },
      { re: /\b(press|release|announc(e|ement)|statement)\b/i, w: 1.1, tag: 'press' },
    ],
  },
  {
    category: 'NFT',
    keywords: [
      { re: /\b(nft|mint|wl|whitelist|floor|collection|opensea|blur)\b/i, w: 2.0, tag: 'nft-core' },
      { re: /\b(art|traits|rarity|reveal)\b/i, w: 1.2, tag: 'nft-meta' },
    ],
  },
  {
    category: 'EARLY',
    keywords: [
      { re: /\b(airdrop|points|farm|farming|task|quest|galxe|zealy)\b/i, w: 2.0, tag: 'airdrop-points' },
      { re: /\b(ido|ieo|launchpad|whitelist|allocation)\b/i, w: 1.8, tag: 'launch' },
      { re: /\b(testnet|incentivized|node|restake|zk)\b/i, w: 1.4, tag: 'early-tech' },
    ],
  },
  {
    category: 'VC',
    keywords: [
      { re: /\b(vc|venture|fund|seed|series\s*[a-d]|round|valuation)\b/i, w: 2.0, tag: 'vc' },
      { re: /\b(portfolio|thesis|deal|investment)\b/i, w: 1.4, tag: 'invest' },
    ],
  },
  {
    category: 'POPULAR',
    keywords: [
      { re: /\b(binance|coinbase|okx|bybit|kraken)\b/i, w: 1.4, tag: 'exchanges' },
      { re: /\b(btc|bitcoin|eth|ethereum|sol|solana)\b/i, w: 0.8, tag: 'majors' },
      { re: /\b(listing|delist|spot|launchpool)\b/i, w: 1.1, tag: 'listings' },
    ],
  },
  {
    category: 'INFLUENCE',
    keywords: [
      { re: /\b(opinion|take|hot\s*take|thoughts)\b/i, w: 1.1, tag: 'opinion' },
      { re: /\b(community|chat|ama|space|live)\b/i, w: 1.1, tag: 'community' },
      { re: /\b(dm|subscribe|support|donate)\b/i, w: 0.8, tag: 'creator' },
    ],
  },
];

export function classifyChannel(texts: string[]): CategoryMatch[] {
  const doc = texts.join('\n').slice(0, 50000);
  const out: CategoryMatch[] = [];

  for (const r of rules) {
    let score = 0;
    const hits: string[] = [];

    for (const k of r.keywords) {
      if (k.re.test(doc)) {
        score += k.w;
        hits.push(k.tag);
      }
    }
    if (r.entities) {
      for (const e of r.entities) {
        const m = doc.match(e.re);
        if (m?.length) {
          score += e.w * Math.min(5, m.length);
          hits.push(`${e.tag}:${Math.min(5, m.length)}`);
        }
      }
    }

    // S-curve to confidence
    const conf = clamp01(1 / (1 + Math.exp(-(score - 2.2))));
    if (conf >= 0.45) out.push({ category: r.category, confidence: conf, hits });
  }

  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
