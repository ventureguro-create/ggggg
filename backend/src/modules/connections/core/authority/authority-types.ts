/**
 * Authority Engine Types
 * 
 * Lightweight internal types for authority calculation
 */

export interface AuthorityNodeLike {
  id: string;
  twitter_score?: number;
  influence_score?: number;
  trend_adjusted_score?: number;
}

export interface AuthorityEdgeLike {
  source: string;
  target: string;
  strength_0_1?: number;
  jaccard?: number;
  shared?: number;
}

export interface AuthorityGraphSnapshot {
  nodes: AuthorityNodeLike[];
  edges: AuthorityEdgeLike[];
}

export interface AuthorityResult {
  version: string;

  // Per node scores (0-1)
  scores_0_1: Record<string, number>;

  // Global stats
  stats: {
    nodes: number;
    edges: number;
    iterations: number;
    converged: boolean;
    last_delta: number;
  };
}

export interface AuthorityExplain {
  summary: string;
  drivers: string[];
  concerns: string[];
  recommendations: string[];
}

export interface AuthorityScoreResponse {
  account_id: string;
  authority_score_0_1: number;
  rank?: number;
  percentile?: number;
  explain: AuthorityExplain;
  computed_at: string;
}
