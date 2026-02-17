/**
 * Hops Graph Adapter
 * 
 * Converts Connections graph format to adjacency list for BFS.
 */

import { hopsConfig as cfg } from "./hops.config.js";

export interface GraphNodeLike {
  id: string;
  influence_score?: number;
  twitter_score?: number;
  trend_adjusted_score?: number;
}

export interface GraphEdgeLike {
  source: string;
  target: string;
  strength_0_1?: number;
  // Fallback fields from overlap
  jaccard?: number;
  shared?: number;
  weight?: number;
}

export interface GraphSnapshotLike {
  nodes: GraphNodeLike[];
  edges: GraphEdgeLike[];
}

export interface AdjacencyEntry {
  to: string;
  strength_0_1: number;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Calculate edge strength from available data
 */
export function edgeStrength01(e: GraphEdgeLike): number {
  // Prefer explicit strength
  if (typeof e.strength_0_1 === "number") {
    return clamp01(e.strength_0_1);
  }
  
  // Use weight if available
  if (typeof e.weight === "number") {
    return clamp01(e.weight);
  }

  // Fallback: from jaccard/shared if present
  const j = typeof e.jaccard === "number" ? clamp01(e.jaccard) : 0;
  const s = typeof e.shared === "number" ? Math.max(0, e.shared) : 0;

  // Proxy: stronger if higher jaccard and shared
  const shared01 = clamp01(s / 120);
  return clamp01(0.65 * j + 0.35 * shared01);
}

/**
 * Build adjacency list from graph snapshot
 * Note: Current graph is undirected (overlap-based)
 * Later: Twitter follow edges will be directed
 */
export function buildAdjacency(snapshot: GraphSnapshotLike): Map<string, AdjacencyEntry[]> {
  const adj = new Map<string, AdjacencyEntry[]>();
  
  // Initialize all nodes
  for (const n of snapshot.nodes) {
    adj.set(n.id, []);
  }

  // Add edges (bidirectional for overlap graph)
  for (const e of snapshot.edges) {
    const w = edgeStrength01(e);
    
    // Source -> Target
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ to: e.target, strength_0_1: w });

    // Target -> Source (undirected for proxy graph)
    // Later for Twitter follow edges this will be conditional
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.target)!.push({ to: e.source, strength_0_1: w });
  }

  return adj;
}

/**
 * Get score from node based on field
 */
export function getNodeScore(node: GraphNodeLike, field: string): number {
  if (field === "twitter_score") {
    return Number(node.twitter_score ?? 0);
  }
  if (field === "trend_adjusted") {
    return Number(node.trend_adjusted_score ?? 0);
  }
  return Number(node.influence_score ?? 0);
}
