/**
 * Text extraction utilities
 */
import { normalizeUsername } from './math.js';

const TME_RE = /(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{4,})/g;
const AT_RE = /@([a-zA-Z0-9_]{4,})/g;

export function extractMentionsFromText(text?: string): string[] {
  if (!text) return [];
  const out = new Set<string>();

  let m: RegExpExecArray | null;
  const tmeRe = new RegExp(TME_RE.source, 'g');
  const atRe = new RegExp(AT_RE.source, 'g');
  
  while ((m = tmeRe.exec(text))) out.add(normalizeUsername(m[1]));
  while ((m = atRe.exec(text))) out.add(normalizeUsername(m[1]));

  return [...out];
}

/**
 * Create text fingerprint for cross-reuse detection
 */
export function createFingerprint(t: string): string {
  const n = normalizeText(t);
  if (!n || n.length < 20) return '';
  const tokens = n.split(' ').filter(w => w.length >= 4).slice(0, 60);
  return tokens.sort().join('|');
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
