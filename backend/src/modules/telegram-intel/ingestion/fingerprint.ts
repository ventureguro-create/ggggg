/**
 * Fingerprint for cross-reuse detection
 */
export function normalizeText(t: string) {
  return (t || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/t\.me\/\S+/g, ' ')
    .replace(/[@$#]\w+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fingerprint(t: string) {
  const n = normalizeText(t);
  if (!n) return '';
  const tokens = n.split(' ').filter((w) => w.length >= 4).slice(0, 60);
  return tokens.sort().join('|');
}
