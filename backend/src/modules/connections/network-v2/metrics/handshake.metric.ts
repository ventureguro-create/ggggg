/**
 * Handshake Score Calculator (Anchor-weighted)
 * 
 * Measures social distance to powerful nodes (Anchors/Backers).
 * 
 * HandshakeScore = weighted proximity to top anchors
 */

import type { HandshakeScore, NetworkEdge } from '../network-v2-plus.types.js';
import { HOP_WEIGHTS, EDGE_TYPE_MULTIPLIERS } from '../network-v2-plus.types.js';

export interface AnchorInfo {
  id: string;
  name: string;
  authority: number;  // 0-1
}

export interface PathInfo {
  hops: number;
  strength: number;  // min edge weight along path
  routeType: 'FOLLOW_ROUTE' | 'COINVEST_ROUTE' | 'ENGAGE_ROUTE' | 'MIXED';
}

// Gamma for anchor weight (elite anchors pull stronger)
const ANCHOR_GAMMA = 1.2;

// Top N anchors to consider
const TOP_N_ANCHORS = 20;

/**
 * Calculate effective edge weight with type multiplier
 */
export function getEffectiveEdgeWeight(edge: NetworkEdge): number {
  const typeMultiplier = EDGE_TYPE_MULTIPLIERS[edge.type] ?? 0.5;
  return edge.weight * edge.confidence * typeMultiplier;
}

/**
 * Calculate anchor weight (authority ^ gamma)
 */
export function getAnchorWeight(authority: number): number {
  return Math.pow(authority, ANCHOR_GAMMA);
}

/**
 * Calculate hop weight
 */
export function getHopWeight(hops: number): number {
  if (hops === 1) return HOP_WEIGHTS[1];
  if (hops === 2) return HOP_WEIGHTS[2];
  if (hops === 3) return HOP_WEIGHTS[3];
  return 0; // More than 3 hops = no connection
}

/**
 * Find best path from account to anchor
 * Returns null if no path within 3 hops
 */
export function findBestPath(
  accountId: string,
  anchorId: string,
  edges: NetworkEdge[],
  maxHops = 3
): PathInfo | null {
  // Build adjacency map
  const adjacency = new Map<string, { neighbor: string; edge: NetworkEdge }[]>();
  
  for (const edge of edges) {
    // Add both directions
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    
    adjacency.get(edge.from)!.push({ neighbor: edge.to, edge });
    adjacency.get(edge.to)!.push({ neighbor: edge.from, edge });
  }
  
  // BFS to find shortest paths
  interface PathNode {
    id: string;
    hops: number;
    minStrength: number;
    edgeTypes: Set<string>;
  }
  
  const visited = new Set<string>();
  const queue: PathNode[] = [{
    id: accountId,
    hops: 0,
    minStrength: 1,
    edgeTypes: new Set(),
  }];
  
  let bestPath: PathInfo | null = null;
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.id === anchorId && current.hops > 0) {
      // Found anchor
      const routeType = determineRouteType(current.edgeTypes);
      const pathStrength = current.minStrength * getHopWeight(current.hops);
      
      if (!bestPath || pathStrength > bestPath.strength) {
        bestPath = {
          hops: current.hops,
          strength: pathStrength,
          routeType,
        };
      }
      continue;
    }
    
    if (current.hops >= maxHops) continue;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    
    const neighbors = adjacency.get(current.id) || [];
    for (const { neighbor, edge } of neighbors) {
      if (visited.has(neighbor)) continue;
      
      const edgeWeight = getEffectiveEdgeWeight(edge);
      const newEdgeTypes = new Set(current.edgeTypes);
      newEdgeTypes.add(edge.type);
      
      queue.push({
        id: neighbor,
        hops: current.hops + 1,
        minStrength: Math.min(current.minStrength, edgeWeight),
        edgeTypes: newEdgeTypes,
      });
    }
  }
  
  return bestPath;
}

/**
 * Determine route type from edge types
 */
function determineRouteType(edgeTypes: Set<string>): PathInfo['routeType'] {
  const types = Array.from(edgeTypes);
  
  if (types.length === 1) {
    if (types[0] === 'FOLLOW') return 'FOLLOW_ROUTE';
    if (types[0] === 'CO_INVESTMENT' || types[0] === 'INVESTED_IN') return 'COINVEST_ROUTE';
    if (types[0] === 'CO_ENGAGEMENT') return 'ENGAGE_ROUTE';
  }
  
  return 'MIXED';
}

/**
 * Calculate proximity to a single anchor
 */
export function calculateProximity(
  path: PathInfo | null,
  anchorAuthority: number
): number {
  if (!path) return 0;
  return path.strength; // Already includes hop weight
}

/**
 * Calculate full handshake score
 */
export function calculateHandshakeScore(
  accountId: string,
  anchors: AnchorInfo[],
  edges: NetworkEdge[]
): HandshakeScore {
  const proximities: HandshakeScore['proximities'] = [];
  let bestAnchor: HandshakeScore['bestAnchor'] = undefined;
  let bestProximity = 0;
  
  // Calculate proximity to each anchor
  for (const anchor of anchors) {
    const path = findBestPath(accountId, anchor.id, edges);
    const proximity = calculateProximity(path, anchor.authority);
    
    if (proximity > 0) {
      proximities.push({
        anchorId: anchor.id,
        anchorName: anchor.name,
        hops: path!.hops,
        proximity,
      });
      
      if (proximity > bestProximity) {
        bestProximity = proximity;
        bestAnchor = {
          anchorId: anchor.id,
          anchorName: anchor.name,
          hops: path!.hops,
          pathStrength: path!.strength,
          routeType: path!.routeType,
        };
      }
    }
  }
  
  // Sort by proximity and take top N
  proximities.sort((a, b) => b.proximity - a.proximity);
  const topProximities = proximities.slice(0, TOP_N_ANCHORS);
  
  // Calculate weighted score
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const p of topProximities) {
    const anchor = anchors.find(a => a.id === p.anchorId);
    if (!anchor) continue;
    
    const anchorWeight = getAnchorWeight(anchor.authority);
    weightedSum += anchorWeight * p.proximity;
    totalWeight += anchorWeight;
  }
  
  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  // Calculate elite exposure (anchors with authority >= 0.85)
  const eliteAnchors = anchors.filter(a => a.authority >= 0.85);
  const eliteProximities = topProximities.filter(p => 
    eliteAnchors.some(a => a.id === p.anchorId)
  );
  const eliteExposure = eliteProximities.length > 0
    ? eliteProximities.reduce((sum, p) => sum + p.proximity, 0) / eliteProximities.length
    : 0;
  
  return {
    twitterId: accountId,
    score,
    bestAnchor,
    eliteExposure,
    proximities: topProximities,
  };
}

console.log('[HandshakeScore] Calculator loaded');
