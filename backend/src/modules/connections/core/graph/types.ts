/**
 * Connections Graph Types
 * 
 * Graph visualization for influencer relationships
 * WITHOUT Twitter dependency
 */

export type NodeType = 'person' | 'fund' | 'project';
export type ProfileType = 'retail' | 'influencer' | 'whale';
export type RiskLevel = 'low' | 'medium' | 'high';
export type EarlySignal = 'none' | 'rising' | 'breakout';
export type EdgeDirection = 'inbound' | 'outbound' | 'mutual';
export type EdgeStrength = 'low' | 'medium' | 'high';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  profile: ProfileType;
  influence_score: number;
  x_score: number;
  trend_state: 'growing' | 'stable' | 'cooling' | 'volatile';
  early_signal: EarlySignal;
  risk_level: RiskLevel;
  // Visual attributes
  size?: number;
  color?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'audience_overlap' | 'engagement_similarity' | 'trend_correlation' | 'profile_relation';
  weight: number;  // 0-1
  strength: EdgeStrength;
  direction: EdgeDirection;
  confidence: number;  // 0-1
  overlap_percent?: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    total_nodes: number;
    total_edges: number;
    layout: 'force' | 'radial' | 'clustered';
    generated_at: string;
    applied_filters: GraphFilters;
  };
}

export interface GraphFilters {
  // Node filters
  node_types?: NodeType[];
  profiles?: ProfileType[];
  influence_range?: [number, number];
  early_signal?: EarlySignal[];
  risk_level?: RiskLevel[];
  
  // Edge filters
  edge_strength?: EdgeStrength[];
  overlap_min?: number;
  direction?: EdgeDirection[];
  
  // View options
  depth?: 1 | 2 | 3;
  hide_isolated?: boolean;
  limit_nodes?: number;
}

export interface NodeDetails {
  id: string;
  label: string;
  profile: ProfileType;
  influence_score: number;
  trend: {
    velocity: number;
    acceleration: number;
    state: string;
  };
  early_signal: {
    badge: EarlySignal;
    score: number;
    confidence: number;
  };
  connected_nodes: Array<{
    id: string;
    label: string;
    relation_type: string;
    weight: number;
  }>;
  why_connected: string[];
}

export interface GraphRanking {
  items: Array<{
    id: string;
    label: string;
    score: number;
    rank: number;
    early_signal?: EarlySignal;
  }>;
  sort_by: 'influence' | 'early_signal' | 'acceleration';
  total: number;
}
