/**
 * Narrative Search Keywords
 * Ключевые слова для поиска в Twitter по нарративам
 */

export const NARRATIVE_SEARCH_KEYWORDS: Record<string, string[]> = {
  AI_AGENTS: [
    'AI agent crypto',
    'autonomous agent blockchain',
    '$FET',
    '$AGIX',
    '$TAO',
    'defi AI',
  ],
  RWA_TOKENIZATION: [
    'RWA crypto',
    'real world asset token',
    '$ONDO',
    'tokenized treasury',
    'RWA tokenization',
  ],
  RESTAKING: [
    'restaking crypto',
    'eigenlayer',
    '$EIGEN',
    'liquid restaking',
    'LRT',
  ],
  DEPIN: [
    'DePIN',
    'decentralized physical infrastructure',
    '$HNT',
    '$RNDR',
    'depin crypto',
  ],
  BTC_L2: [
    'bitcoin L2',
    'BTC layer 2',
    '$STX',
    'ordinals',
    'runes crypto',
  ],
  MEME_COINS: [
    'meme coin',
    '$PEPE',
    '$WIF',
    '$BONK',
    'pump fun',
  ],
  GAMING: [
    'gamefi',
    'play to earn',
    '$IMX',
    '$GALA',
    'crypto gaming',
  ],
  MODULAR: [
    'modular blockchain',
    'data availability',
    '$TIA',
    'celestia',
    'rollup',
  ],
};

/**
 * High-signal influencer accounts to monitor
 */
export const NARRATIVE_INFLUENCERS: string[] = [
  'coaboricua',
  'hsaka',
  'inversebrah',
  'defiignas',
  'route2fi',
  'sassal0x',
  'evan_ss',
  'telovedai',
  'wolfofsolana',
  'cryptowizard',
  'blknoiz06',
  'zachxbt',
  'lookonchain',
  'whale_alert',
];

/**
 * Get all search keywords for narrative detection
 */
export function getAllSearchKeywords(): string[] {
  const all: string[] = [];
  for (const keywords of Object.values(NARRATIVE_SEARCH_KEYWORDS)) {
    all.push(...keywords);
  }
  return [...new Set(all)];
}

/**
 * Get keywords for specific narrative
 */
export function getKeywordsForNarrative(narrativeKey: string): string[] {
  return NARRATIVE_SEARCH_KEYWORDS[narrativeKey] || [];
}
