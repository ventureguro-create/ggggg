/**
 * Authority Module - Main Export
 */

export { authorityConfig, updateAuthorityConfig, getAuthorityConfig } from './authority-config.js';
export type { AuthorityConfig } from './authority-config.js';

export { computeAuthority, computeAuthorityForNode, getTopAuthorities } from './authority-engine.js';

export { explainAuthority, explainAuthorityComparison, getAuthorityTier } from './authority-explain.js';

export { normalizeScores, calculatePercentile, calculateRank } from './authority-normalize.js';

export { buildWeightedAdj, getDanglingNodes } from './authority-graph-adapter.js';

export type { 
  AuthorityNodeLike,
  AuthorityEdgeLike,
  AuthorityGraphSnapshot,
  AuthorityResult,
  AuthorityExplain,
  AuthorityScoreResponse,
} from './authority-types.js';
