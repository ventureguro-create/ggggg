/**
 * Network Paths Types
 * 
 * Types for network path analysis and exposure computation
 */

export type AuthorityTier = 'elite' | 'high' | 'upper_mid' | 'mid' | 'low_mid' | 'low';

export interface PathNode {
  id: string;
  authority_score_0_1: number; // 0..1
  authority_tier: AuthorityTier;
  handle?: string;
  label?: string;
}

// Path badge types for UX interpretation
export type PathBadge = 
  | 'strong_access'    // strength > 0.7
  | 'smart_route'      // authority_sum > P75
  | 'short_reach'      // hops ≤ 2
  | 'elite_touch';     // target tier = elite

export interface NetworkPath {
  from: string;
  to: string;
  hops: number;
  nodes: PathNode[]; // includes from..to
  strength: number; // bottleneck (min authority)
  authority_sum: number; // sum authority along path
  contribution_0_1: number; // normalized contribution
  kind: 'shortest' | 'strongest' | 'elite';
  // Phase 3.4 POLISH: Path interpretation
  badges?: PathBadge[];
  explain_text?: string;
}

export interface NetworkExposure {
  account_id: string;
  avg_hops_to_elite: number | null;
  avg_hops_to_high: number | null;
  reachable_elite: number;
  reachable_high: number;
  exposure_score_0_1: number;
  exposure_tier: 'weak' | 'moderate' | 'strong' | 'elite';
}

export interface PathsRequest {
  account_id: string;
  max_depth?: number;
  target_ids?: string[];
}

export interface PathsResponse {
  version: string;
  account_id: string;
  max_depth: number;
  targets_considered: number;
  paths: NetworkPath[];
  explain: {
    summary: string;
    bullets: string[];
  };
}

// Graph types for internal use
export interface GraphNode {
  id: string;
  authority_score_0_1?: number;
  authority_tier?: AuthorityTier;
  handle?: string;
  label?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight_0_1?: number;
  strength?: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
