/**
 * Token Extractor
 * Robust crypto-oriented token extraction from text
 * 
 * Supports:
 * - $TOKEN (cashtags) - highest confidence
 * - #TOKEN (hashtags)
 * - (TOKEN) pattern with context
 * - ARB/USDT exchange pairs
 */

type ExtractedToken = {
  token: string; // UPPER
  source: 'cashtag' | 'hashtag' | 'plain';
  confidence: number; // 0..1
  snippet: string;
};

const CASHTAG_RE = /\$([A-Za-z]{2,10})\b/g;             // $ARB
const HASHTAG_RE = /#([A-Za-z]{2,12})\b/g;              // #SOL
const PAREN_TICKER_RE = /\(([A-Za-z]{2,10})\)/g;        // (ARB)
const EXCHANGE_PAIR_RE = /\b([A-Za-z]{2,10})\/(USDT|USD|BTC|ETH)\b/gi; // ARB/USDT

// exclude obvious noise
const STOP = new Set([
  'USD', 'USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'TON', // keep majors? depends: we keep, but treat lower confidence
  'CEO', 'NFT', 'DEX', 'CEX', 'IDO', 'IEO', 'KYC', 'P2P', 'FOMO', 'ATH', 'ATL', 'API', 'AI',
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR',
]);

function normalizeToken(t: string) {
  return String(t || '').toUpperCase();
}

// very cheap heuristic: if token appears next to "listing", "airdrop" etc. -> higher confidence
function contextBoost(text: string, idx: number) {
  const window = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 60)).toLowerCase();
  const keys = ['listing', 'airdrop', 'launch', 'tge', 'ido', 'binance', 'okx', 'bybit', 'gate', 'kucoin', 'dex', 'perps', 'pump', 'moon', 'buy', 'sell'];
  let boost = 0;
  for (const k of keys) if (window.includes(k)) boost += 0.06;
  return Math.min(0.18, boost);
}

function makeSnippet(text: string, idx: number) {
  const s = text.slice(Math.max(0, idx - 60), Math.min(text.length, idx + 80));
  return s.replace(/\s+/g, ' ').trim();
}

function pickBetter(prev: ExtractedToken | undefined, next: ExtractedToken) {
  if (!prev) return next;
  // prefer higher confidence; if close, prefer cashtag source
  if (next.confidence > prev.confidence + 0.03) return next;
  if (Math.abs(next.confidence - prev.confidence) <= 0.03) {
    const rank = (s: ExtractedToken['source']) => (s === 'cashtag' ? 3 : s === 'hashtag' ? 2 : 1);
    if (rank(next.source) > rank(prev.source)) return next;
  }
  return prev;
}

export function extractTokens(text?: string): ExtractedToken[] {
  const raw = String(text || '');
  if (!raw) return [];

  const out = new Map<string, ExtractedToken>(); // de-dup per token

  // 1) cashtags - highest confidence
  for (const m of raw.matchAll(CASHTAG_RE)) {
    const token = normalizeToken(m[1]);
    if (token.length < 2) continue;

    let conf = 0.82;
    if (STOP.has(token)) conf -= 0.22;
    conf += contextBoost(raw, m.index ?? 0);

    const item: ExtractedToken = {
      token,
      source: 'cashtag',
      confidence: Math.max(0.05, Math.min(1, conf)),
      snippet: makeSnippet(raw, m.index ?? 0),
    };
    out.set(token, pickBetter(out.get(token), item));
  }

  // 2) exchange pair like ARB/USDT
  for (const m of raw.matchAll(EXCHANGE_PAIR_RE)) {
    const token = normalizeToken(m[1]);
    if (token.length < 2) continue;

    let conf = 0.58;
    if (STOP.has(token)) conf -= 0.18;
    conf += contextBoost(raw, m.index ?? 0);

    const item: ExtractedToken = {
      token,
      source: 'plain',
      confidence: Math.max(0.05, Math.min(1, conf)),
      snippet: makeSnippet(raw, m.index ?? 0),
    };
    out.set(token, pickBetter(out.get(token), item));
  }

  // 3) hashtags
  for (const m of raw.matchAll(HASHTAG_RE)) {
    const token = normalizeToken(m[1]);
    if (token.length < 2) continue;

    let conf = 0.64;
    if (STOP.has(token)) conf -= 0.18;
    conf += contextBoost(raw, m.index ?? 0);

    const item: ExtractedToken = {
      token,
      source: 'hashtag',
      confidence: Math.max(0.05, Math.min(1, conf)),
      snippet: makeSnippet(raw, m.index ?? 0),
    };
    out.set(token, pickBetter(out.get(token), item));
  }

  // 4) (TICKER) pattern — very noisy, keep only if boosted by context
  for (const m of raw.matchAll(PAREN_TICKER_RE)) {
    const token = normalizeToken(m[1]);
    if (token.length < 2) continue;

    const boost = contextBoost(raw, m.index ?? 0);
    if (boost < 0.06) continue; // gate: only if context suggests markets

    let conf = 0.45 + boost;
    if (STOP.has(token)) conf -= 0.18;

    const item: ExtractedToken = {
      token,
      source: 'plain',
      confidence: Math.max(0.05, Math.min(1, conf)),
      snippet: makeSnippet(raw, m.index ?? 0),
    };
    out.set(token, pickBetter(out.get(token), item));
  }

  // final filter: remove ultra-low confidence and invalid tokens
  return [...out.values()].filter(x => x.confidence >= 0.35 && /^[A-Z0-9]{2,10}$/.test(x.token));
}
