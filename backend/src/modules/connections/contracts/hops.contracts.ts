/**
 * Hops / Social Distance Contracts v1.0
 * 
 * Defines structures for shortest path and authority proximity calculations.
 * Works with current overlap graph, ready for Twitter follow edges later.
 */

export type ConfidenceLevel = "LOW" | "MED" | "HIGH";

/**
 * Input for hops calculation
 */
export interface HopsInput {
  account_id: string;

  // Optional: graph snapshot ID (if not provided, uses current graph)
  graph_state_id?: string;

  // How far to search (1-3 hops)
  max_hops?: 1 | 2 | 3;

  // Define "top nodes" set
  top_nodes?: {
    mode: "top_n" | "explicit";
    top_n?: number;                  // default 20
    explicit_ids?: string[];         // for explicit mode
    score_field?: "twitter_score" | "influence_score" | "trend_adjusted";
  };

  // Edge filtering / thresholds
  edge_min_strength?: number;        // 0..1 (computed from overlap/score)
  include_weak_edges?: boolean;      // if true ignores threshold
}

/**
 * Single path to a target
 */
export interface HopPath {
  hops: number;
  path: string[];           // [source, ..., target]
  path_strength_0_1: number; // min-edge strength along path (bottleneck)
}

/**
 * Closest top target summary
 */
export interface ClosestTarget {
  target_id: string;
  hops: number;
  path_strength_0_1: number;
}

/**
 * Summary of hops analysis
 */
export interface HopsSummary {
  max_hops: number;

  reachable_top_nodes: number;
  min_hops_to_any_top: number | null;
  avg_hops_to_reached_top: number | null;

  // Compact "two handshakes to X"
  closest_top_targets: ClosestTarget[];

  // Final metric for Twitter Score (0..1)
  authority_proximity_score_0_1: number;

  confidence: ConfidenceLevel;

  notes: string[];
}

/**
 * Full hops result
 */
export interface HopsResult {
  account_id: string;
  version: string;

  summary: HopsSummary;

  // Optional detailed paths for UI
  paths_to_top: HopPath[];

  explain: {
    summary: string;
    drivers: string[];
    concerns: string[];
    recommendations: string[];
  };

  meta: {
    computed_at: string;
    graph_nodes: number;
    graph_edges: number;
    top_nodes_count: number;
  };
}

/**
 * Batch result
 */
export interface HopsBatchResult {
  version: string;
  computed_at: string;
  results: HopsResult[];
  stats: {
    total: number;
    avg_proximity: number;
    well_connected_count: number;  // score >= 0.40
    isolated_count: number;        // score < 0.15
  };
}
