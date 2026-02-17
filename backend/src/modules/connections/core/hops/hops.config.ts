/**
 * Hops Engine Configuration v1.0
 * 
 * All weights, thresholds, and tunable parameters.
 */

export const HOPS_VERSION = "1.0.0";

export interface HopsConfigType {
  version: string;
  
  defaults: {
    max_hops: 1 | 2 | 3;
    top_n: number;
    score_field: "twitter_score" | "influence_score" | "trend_adjusted";
    edge_min_strength: number;
  };
  
  scoring: {
    hop_weight: Record<number, number>;
    strength_weight: number;
  };
  
  confidence: {
    min_nodes_for_high: number;
    min_edges_for_high: number;
    min_nodes_for_med: number;
    min_edges_for_med: number;
  };
}

export const hopsConfig: HopsConfigType = {
  version: HOPS_VERSION,

  defaults: {
    max_hops: 3,
    top_n: 20,
    score_field: "twitter_score",
    edge_min_strength: 0.35,  // proxy threshold
  },

  // Scoring weights
  scoring: {
    // Hops -> weight (closer = much better)
    hop_weight: {
      1: 1.00,
      2: 0.65,
      3: 0.40,
    },
    // Path strength contribution vs hops
    strength_weight: 0.35,
  },

  // Confidence requirements
  confidence: {
    min_nodes_for_high: 40,
    min_edges_for_high: 120,
    min_nodes_for_med: 15,
    min_edges_for_med: 30,
  },
};

/**
 * Get current config
 */
export function getHopsConfig(): HopsConfigType {
  return hopsConfig;
}

/**
 * Update config (for admin panel)
 */
export function updateHopsConfig(updates: Partial<HopsConfigType>): void {
  if (updates.defaults) Object.assign(hopsConfig.defaults, updates.defaults);
  if (updates.scoring) Object.assign(hopsConfig.scoring, updates.scoring);
  if (updates.confidence) Object.assign(hopsConfig.confidence, updates.confidence);
  console.log('[Hops] Config updated:', hopsConfig.version);
}
