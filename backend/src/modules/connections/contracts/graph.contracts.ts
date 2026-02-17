/**
 * Graph Contracts - Unified format for Connections Graph
 * 
 * This is the single source of truth for graph data structures.
 * Both backend and frontend use these contracts.
 */

import { z } from 'zod';

// ============================================================
// NODE TYPES
// ============================================================

export type NodeType = 'person' | 'fund' | 'project' | 'other';
export type ProfileType = 'retail' | 'influencer' | 'whale';
export type RiskLevel = 'low' | 'medium' | 'high';
export type EarlySignalBadge = 'none' | 'rising' | 'breakout';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'critical';

/**
 * Data Confidence for Overlay (Phase 4.1.7)
 */
export interface NodeConfidence {
  score: number;        // 0..1
  level: ConfidenceLevel;
  warnings: string[];
}

/**
 * Graph Node - represents a Twitter account/influencer
 */
export interface GraphNode {
  id: string;
  handle: string;
  display_name: string;
  avatar?: string;
  
  // Scores
  influence_score: number;
  x_score: number;
  adjusted_influence: number;
  
  // Classification
  node_type: NodeType;
  profile_type: ProfileType;
  risk_level: RiskLevel;
  early_signal: EarlySignalBadge;
  
  // Data Confidence (Phase 4.1.7)
  confidence?: NodeConfidence;
  
  // Metrics
  followers_count?: number;
  engagement_rate?: number;
  posts_per_day?: number;
  red_flags_count: number;
  
  // Tags for filtering
  tags: string[];
  
  // Visual (computed by frontend or backend)
  size?: number;
  color?: string;
  x?: number;
  y?: number;
}

// ============================================================
// EDGE TYPES
// ============================================================

/**
 * Edge types - currently only OVERLAP, but extensible
 */
export type EdgeType = 
  | 'OVERLAP'      // audience overlap (from engaged_user_ids)
  | 'MENTION'      // Twitter mention (future)
  | 'CO_MENTION'   // mentioned together (future)
  | 'FOLLOW'       // follow relationship (future)
  | 'LIST'         // same Twitter list (future)
  | 'REPOST';      // retweet/quote (future)

/**
 * Graph Edge - represents a relationship between nodes
 */
export interface GraphEdge {
  id: string;
  source: string;      // node id
  target: string;      // node id
  
  // Edge classification
  edge_type: EdgeType;
  
  // Overlap metrics (for OVERLAP type)
  shared_count: number;
  jaccard: number;
  a_to_b: number;      // % of A's audience that overlaps with B
  b_to_a: number;      // % of B's audience that overlaps with A
  
  // Computed
  weight: number;      // 0-1, used for visual thickness
  strength: 'low' | 'medium' | 'high';
  
  // Direction (for future edge types)
  direction: 'none' | 'a_to_b' | 'b_to_a' | 'bidirectional';
}

// ============================================================
// GRAPH RESPONSE
// ============================================================

/**
 * Full graph response from API
 */
export interface ConnectionsGraphResponse {
  ok: boolean;
  
  // Seed info
  seed?: {
    id: string;
    handle: string;
    display_name: string;
  };
  
  // Graph data
  nodes: GraphNode[];
  edges: GraphEdge[];
  
  // Statistics
  stats: {
    total_nodes: number;
    total_edges: number;
    avg_degree: number;
    density: number;
    max_jaccard: number;
    min_jaccard: number;
    build_time_ms: number;
  };
  
  // Applied filters/params
  params: {
    depth: number;
    limit: number;
    min_jaccard: number;
    min_shared: number;
    max_degree: number;
  };
}

// ============================================================
// SUGGESTIONS
// ============================================================

export interface GraphSuggestion {
  id: string;
  handle: string;
  display_name: string;
  avatar?: string;
  
  reason: 'top_influence' | 'breakout' | 'rising' | 'high_overlap';
  score: number;
  badge?: EarlySignalBadge;
}

export interface GraphSuggestionsResponse {
  ok: boolean;
  suggestions: GraphSuggestion[];
  seed_id?: string;
}

// ============================================================
// FILTERS SCHEMA (for dynamic filter UI)
// ============================================================

export type FilterFieldType = 'range' | 'select' | 'multiselect' | 'checkbox' | 'buckets';

export interface FilterField {
  key: string;
  label: string;
  type: FilterFieldType;
  
  // For range
  min?: number;
  max?: number;
  step?: number;
  
  // For select/multiselect
  options?: Array<{ value: string; label: string }>;
  
  // For buckets
  buckets?: Array<{ value: string; label: string; range: [number, number] }>;
  
  // Default value
  default_value?: any;
}

export interface GraphFiltersSchema {
  ok: boolean;
  filters: {
    nodes: FilterField[];
    edges: FilterField[];
    view: FilterField[];
  };
}

// ============================================================
// GRAPH CONFIG (Admin)
// ============================================================

export interface GraphConfig {
  // Enable/disable
  graph_enabled: boolean;
  
  // Build params
  default_depth: number;
  default_limit: number;
  min_jaccard: number;
  min_shared: number;
  max_degree: number;
  
  // Performance
  cache_ttl_seconds: number;
  max_candidates: number;
  
  // Layout hints
  force_charge: number;
  force_spacing: number;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  graph_enabled: true,
  default_depth: 2,
  default_limit: 50,
  min_jaccard: 0.05,
  min_shared: 3,
  max_degree: 20,
  cache_ttl_seconds: 300,
  max_candidates: 200,
  force_charge: -100,
  force_spacing: 50,
};

// ============================================================
// ZOD SCHEMAS (for validation)
// ============================================================

export const GraphQuerySchema = z.object({
  seed: z.string().optional(),
  depth: z.coerce.number().min(1).max(3).default(2),
  limit: z.coerce.number().min(5).max(200).default(50),
  min_jaccard: z.coerce.number().min(0).max(1).default(0.05),
  min_shared: z.coerce.number().min(1).max(100).default(3),
  max_degree: z.coerce.number().min(1).max(50).default(20),
  
  // Node filters
  node_types: z.array(z.enum(['person', 'fund', 'project', 'other'])).optional(),
  profile_types: z.array(z.enum(['retail', 'influencer', 'whale'])).optional(),
  risk_levels: z.array(z.enum(['low', 'medium', 'high'])).optional(),
  early_signals: z.array(z.enum(['none', 'rising', 'breakout'])).optional(),
  min_influence: z.coerce.number().optional(),
  max_influence: z.coerce.number().optional(),
  tags: z.array(z.string()).optional(),
});

export type GraphQueryParams = z.infer<typeof GraphQuerySchema>;

export const GraphConfigSchema = z.object({
  graph_enabled: z.boolean(),
  default_depth: z.number().min(1).max(3),
  default_limit: z.number().min(5).max(200),
  min_jaccard: z.number().min(0).max(1),
  min_shared: z.number().min(1).max(100),
  max_degree: z.number().min(1).max(50),
  cache_ttl_seconds: z.number().min(0).max(3600),
  max_candidates: z.number().min(10).max(1000),
  force_charge: z.number(),
  force_spacing: z.number(),
});
