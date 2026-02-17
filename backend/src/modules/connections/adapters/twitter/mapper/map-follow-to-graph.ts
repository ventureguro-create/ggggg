/**
 * Map Twitter Follow Edges to Graph Edges
 * 
 * Converts TwitterFollowEdge into Connections graph edges.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 */

import type { TwitterFollowEdge, TwitterFollowSummary } from '../contracts/index.js';

/**
 * Connections graph edge format
 */
export interface ConnectionsGraphEdge {
  from: string;
  to: string;
  weight: number;
  edge_type: 'follow';
  created_at?: Date;
  source: 'twitter';
}

/**
 * Connections graph node update (for followers/following counts)
 */
export interface ConnectionsNodeUpdate {
  node_id: string;
  handle?: string;
  followers: number;
  following: number;
  source: 'twitter';
  updated_at: Date;
}

/**
 * Map single follow edge
 */
export function mapFollowToGraphEdge(edge: TwitterFollowEdge): ConnectionsGraphEdge {
  return {
    from: edge.from_id,
    to: edge.to_id,
    weight: 1,  // Base weight, can be enhanced later
    edge_type: 'follow',
    created_at: edge.discovered_at,
    source: 'twitter',
  };
}

/**
 * Map multiple follow edges
 */
export function mapFollowsToGraphEdges(
  edges: TwitterFollowEdge[]
): ConnectionsGraphEdge[] {
  return edges.map(mapFollowToGraphEdge);
}

/**
 * Map follow summary to node update
 */
export function mapFollowSummaryToNodeUpdate(
  summary: TwitterFollowSummary
): ConnectionsNodeUpdate {
  return {
    node_id: summary.author_id,
    handle: summary.username,
    followers: summary.followers_count,
    following: summary.following_count,
    source: 'twitter',
    updated_at: summary.collected_at,
  };
}

/**
 * Extract unique nodes from edges
 */
export function extractNodesFromEdges(
  edges: TwitterFollowEdge[]
): Set<string> {
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.from_id);
    nodes.add(edge.to_id);
  }
  return nodes;
}

/**
 * Build adjacency list from edges
 */
export function buildAdjacencyList(
  edges: ConnectionsGraphEdge[]
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  
  for (const edge of edges) {
    if (!adj.has(edge.from)) {
      adj.set(edge.from, []);
    }
    adj.get(edge.from)!.push(edge.to);
  }
  
  return adj;
}
