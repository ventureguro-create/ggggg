/**
 * Extract mentions from text
 */
const TME_RE = /(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{4,})/g;
const AT_RE = /@([a-zA-Z0-9_]{4,})/g;

export function extractMentionsFromText(text?: string): string[] {
  if (!text) return [];
  const out = new Set<string>();

  let m: RegExpExecArray | null;
  const tmeRe = new RegExp(TME_RE.source, 'g');
  const atRe = new RegExp(AT_RE.source, 'g');
  
  while ((m = tmeRe.exec(text))) out.add(String(m[1]).toLowerCase());
  while ((m = atRe.exec(text))) out.add(String(m[1]).toLowerCase());

  return [...out];
}
