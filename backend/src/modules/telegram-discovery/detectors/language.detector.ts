/**
 * Language Detector
 * 
 * Fast heuristics for RU/UA/EN detection
 */
import { clamp01 } from '../utils/math.js';

export type Lang = 'EN' | 'RU' | 'UA' | 'MIXED' | 'UNKNOWN';

export interface LangResult {
  language: Lang;
  ruScore: number;
  uaScore: number;
  enScore: number;
}

function ratio(re: RegExp, s: string): number {
  const m = s.match(re);
  return (m?.length || 0) / Math.max(1, s.length);
}

export function detectLanguage(texts: string[]): LangResult {
  const doc = (texts.join(' ').slice(0, 20000) || '').trim();
  if (!doc) return { language: 'UNKNOWN', ruScore: 0, uaScore: 0, enScore: 0 };

  // Cyrillic
  const cyr = ratio(/[А-Яа-яЁёІіЇїЄєҐґ]/g, doc);
  const lat = ratio(/[A-Za-z]/g, doc);

  // UA-specific: і, ї, є, ґ
  const ua = ratio(/[ІіЇїЄєҐґ]/g, doc);

  // RU-specific: ё, ы, э
  const ru = ratio(/[ЁёЫыЭэ]/g, doc);

  const en = lat;

  // Normalize
  const base = Math.max(1e-9, cyr + lat);
  const ruScore = clamp01((cyr * 0.75 + ru * 2.5) / base);
  const uaScore = clamp01((cyr * 0.75 + ua * 3.5) / base);
  const enScore = clamp01(lat / base);

  let language: Lang = 'MIXED';
  const max = Math.max(ruScore, uaScore, enScore);

  if (max < 0.55) language = 'MIXED';
  else if (max === enScore) language = 'EN';
  else if (uaScore > ruScore) language = 'UA';
  else language = 'RU';

  return { language, ruScore, uaScore, enScore };
}
