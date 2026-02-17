/**
 * Graph Overlay Contracts (Phase 4.4)
 * 
 * Extends graph contracts with overlay metadata for Live vs Mock comparison.
 */

export type OverlaySource = 'mock' | 'live' | 'both';
export type OverlayStatus = 'confirmed' | 'divergent' | 'weak';
export type GraphOverlayMode = 'mock' | 'live' | 'blended';

/**
 * Node overlay metadata
 */
export interface GraphOverlayNodeMeta {
  source: OverlaySource;
  live_present: boolean;
  confidence: number; // 0..100
}

/**
 * Edge overlay metadata
 */
export interface GraphOverlayEdgeMeta {
  source: OverlaySource;
  status: OverlayStatus;
  confidence: number; // 0..100
  weight_mock?: number; // 0..1
  weight_live?: number; // 0..1
  hide_reason?: 'LOW_CONFIDENCE' | 'GUARD_BLOCK' | 'NO_LIVE';
  signals?: string[];
  risk_flags?: string[];
}

/**
 * Graph overlay config (admin-controlled)
 */
export interface GraphOverlayConfig {
  enabled: boolean;
  mode: GraphOverlayMode;             // default 'mock'
  min_edge_confidence: number;        // default 60
  show_low_confidence: boolean;       // default false
  show_divergent: boolean;            // default true
  prefer_live_when_both: boolean;     // default true
  divergence_threshold: number;       // 0..1, default 0.2
}

export const DEFAULT_GRAPH_OVERLAY_CONFIG: GraphOverlayConfig = {
  enabled: true,
  mode: 'mock',
  min_edge_confidence: 60,
  show_low_confidence: false,
  show_divergent: true,
  prefer_live_when_both: true,
  divergence_threshold: 0.2,
};

/**
 * Overlay stats for UI
 */
export interface GraphOverlayStats {
  nodes_total: number;
  nodes_live: number;
  edges_total: number;
  edges_live: number;
  edges_both: number;
  edges_divergent: number;
  avg_confidence: number;
  hidden_edges: number;
}

/**
 * Full overlay response
 */
export interface ConnectionsGraphOverlayResponse {
  version: '1.0';
  mode: GraphOverlayMode;
  stats: GraphOverlayStats;
  graph: any; // ConnectionsGraphResponse with overlay metadata
}
