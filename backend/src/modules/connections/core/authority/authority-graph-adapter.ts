/**
 * Authority Graph Adapter
 * 
 * Converts graph snapshot to weighted adjacency list for PageRank computation
 */

import { AuthorityGraphSnapshot, AuthorityEdgeLike } from './authority-types.js';
import { authorityConfig as cfg } from './authority-config.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Calculate edge strength from available data
 */
function edgeStrength01(e: AuthorityEdgeLike): number {
  // Direct strength if provided
  if (typeof e.strength_0_1 === 'number') {
    return clamp01(e.strength_0_1);
  }

  // Calculate from jaccard and shared
  const j = typeof e.jaccard === 'number' ? clamp01(e.jaccard) : 0;
  const s = typeof e.shared === 'number' ? Math.max(0, e.shared) : 0;
  const shared01 = clamp01(s / 120); // Normalize shared count
  
  return clamp01(0.65 * j + 0.35 * shared01);
}

export interface AdjEntry {
  to: string;
  w: number;
}

/**
 * Build weighted adjacency list from graph snapshot
 * 
 * - Filters weak edges
 * - Handles undirected proxy mode
 * - Normalizes outgoing weights to sum=1 (transition probabilities)
 */
export function buildWeightedAdj(
  snapshot: AuthorityGraphSnapshot
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  
  // Initialize all nodes
  for (const n of snapshot.nodes) {
    adj.set(n.id, []);
  }

  // Process edges
  for (const e of snapshot.edges) {
    const w = edgeStrength01(e);
    
    // Skip weak edges
    if (w < cfg.min_edge_strength) continue;

    // Add forward edge
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ to: e.target, w });

    // Add reverse edge for undirected proxy mode
    if (cfg.use_undirected_proxy) {
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.target)!.push({ to: e.source, w });
    }
  }

  // Normalize outgoing weights per node to sum=1 (transition probabilities)
  for (const [_id, list] of adj.entries()) {
    const sum = list.reduce((a, b) => a + b.w, 0);
    if (sum > 0) {
      for (const it of list) {
        it.w = it.w / sum;
      }
    }
  }

  return adj;
}

/**
 * Get dangling nodes (nodes with no outgoing edges)
 */
export function getDanglingNodes(adj: Map<string, AdjEntry[]>): string[] {
  const dangling: string[] = [];
  for (const [id, list] of adj.entries()) {
    if (list.length === 0) {
      dangling.push(id);
    }
  }
  return dangling;
}
