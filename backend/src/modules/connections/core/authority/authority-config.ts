/**
 * Authority Engine Configuration
 * 
 * PageRank-like algorithm parameters for network authority calculation
 */

export const AUTHORITY_VERSION = "1.0.0";

export interface AuthorityConfig {
  version: string;
  
  // PageRank-like parameters
  damping: number;           // typical 0.85
  iterations: number;        // 10-30 is enough for stable graphs
  tolerance: number;         // early stop if delta small
  
  // Edge processing
  min_edge_strength: number; // ignore very weak edges
  use_undirected_proxy: boolean; // overlap graph is undirected proxy
  
  // Normalization
  normalize: {
    method: 'minmax' | 'softmax' | 'rank';
    clamp: boolean;
  };
  
  // Integration weights for Twitter Score
  twitter_score_network_mix: {
    audience_quality: number;
    authority_proximity: number;
    authority_score: number;
  };
  
  // Feature flags
  enabled: boolean;
}

export const authorityConfig: AuthorityConfig = {
  version: AUTHORITY_VERSION,

  // PageRank-like
  damping: 0.85,
  iterations: 20,
  tolerance: 1e-6,

  // Edge processing
  min_edge_strength: 0.15,
  use_undirected_proxy: true,

  // Normalization
  normalize: {
    method: 'minmax',
    clamp: true,
  },

  // Integration weights (Phase 3.1.3)
  twitter_score_network_mix: {
    audience_quality: 0.45,
    authority_proximity: 0.30,
    authority_score: 0.25,
  },
  
  enabled: true,
};

export function updateAuthorityConfig(updates: Partial<AuthorityConfig>): AuthorityConfig {
  Object.assign(authorityConfig, updates);
  return authorityConfig;
}

export function getAuthorityConfig(): AuthorityConfig {
  return { ...authorityConfig };
}
