/**
 * Hops Engine v1.0
 * 
 * BFS-based shortest path calculation and authority proximity scoring.
 */

import type { 
  HopsInput, 
  HopsResult, 
  HopPath, 
  ClosestTarget,
  ConfidenceLevel 
} from "../../contracts/hops.contracts.js";
import { hopsConfig as cfg, HOPS_VERSION } from "./hops.config.js";
import { 
  buildAdjacency, 
  getNodeScore,
  type GraphSnapshotLike 
} from "./hops.graph-adapter.js";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Determine confidence based on graph size
 */
function confidenceFromGraph(nodes: number, edges: number): ConfidenceLevel {
  if (nodes >= cfg.confidence.min_nodes_for_high && edges >= cfg.confidence.min_edges_for_high) {
    return "HIGH";
  }
  if (nodes >= cfg.confidence.min_nodes_for_med && edges >= cfg.confidence.min_edges_for_med) {
    return "MED";
  }
  return "LOW";
}

/**
 * Select top nodes based on input configuration
 */
function pickTopNodes(snapshot: GraphSnapshotLike, input: HopsInput): string[] {
  const mode = input.top_nodes?.mode ?? "top_n";
  const field = input.top_nodes?.score_field ?? cfg.defaults.score_field;

  if (mode === "explicit") {
    return (input.top_nodes?.explicit_ids ?? []).slice(0, 200);
  }

  const topN = input.top_nodes?.top_n ?? cfg.defaults.top_n;

  return snapshot.nodes
    .slice()
    .sort((a, b) => getNodeScore(b, field) - getNodeScore(a, field))
    .slice(0, topN)
    .map(n => n.id);
}

interface PrevEntry { 
  prev: string | null; 
  bottleneck: number; 
  depth: number; 
}

/**
 * Reconstruct path from BFS predecessor map
 */
function reconstructPath(src: string, target: string, prevMap: Map<string, PrevEntry>): HopPath | null {
  const entry = prevMap.get(target);
  if (!entry) return null;

  const path: string[] = [];
  let cur: string | null = target;
  let bottleneck = entry.bottleneck;

  while (cur) {
    path.push(cur);
    const e = prevMap.get(cur);
    if (!e || e.prev === null) break;
    bottleneck = Math.min(bottleneck, e.bottleneck);
    cur = e.prev;
  }

  path.reverse();
  const hops = path.length - 1;
  
  return { 
    hops, 
    path, 
    path_strength_0_1: clamp01(entry.bottleneck) 
  };
}

/**
 * Generate explain text based on results
 */
function generateExplain(
  reached: number,
  minHops: number | null,
  score01: number,
  confidence: ConfidenceLevel
): { summary: string; drivers: string[]; concerns: string[]; recommendations: string[] } {
  const drivers: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Positive drivers
  if (score01 >= 0.35) {
    drivers.push("Account is close to strong network nodes (by handshakes).");
  }
  if (minHops !== null && minHops <= 2) {
    drivers.push(`Direct/near-direct connections: minimum ${minHops} hop(s) to top nodes.`);
  }
  if (reached >= 10) {
    drivers.push(`Well-connected: reaches ${reached} top nodes within max hops.`);
  }

  // Concerns
  if (reached === 0) {
    concerns.push("No short paths to strong nodes found in current graph.");
  }
  if (confidence === "LOW") {
    concerns.push("Low confidence: small graph or insufficient connections.");
  }
  if (minHops !== null && minHops >= 3) {
    concerns.push("Relatively distant from top nodes (3+ hops).");
  }

  // Recommendations
  recommendations.push("Connect follow-edges (Twitter) for accurate handshake paths.");
  recommendations.push("Use edge strength filter to remove weak/random connections.");
  if (reached < 5 && reached > 0) {
    recommendations.push("Expand network by engaging with more influential accounts.");
  }

  // Summary
  let summary: string;
  if (reached === 0) {
    summary = "Strong handshakes not detected in current graph.";
  } else if (score01 >= 0.45) {
    summary = "Account is well-embedded in the network of strong nodes.";
  } else if (score01 >= 0.25) {
    summary = "Account has some connections to strong nodes, but proximity is average.";
  } else {
    summary = "Weak network position: few connections to influential nodes.";
  }

  return { summary, drivers, concerns, recommendations };
}

/**
 * Main: compute hops proximity to top nodes
 */
export function computeHops(input: HopsInput, snapshot: GraphSnapshotLike): HopsResult {
  const src = input.account_id;
  const maxHops = input.max_hops ?? cfg.defaults.max_hops;
  const minStrength = input.include_weak_edges 
    ? 0 
    : (input.edge_min_strength ?? cfg.defaults.edge_min_strength);

  const adj = buildAdjacency(snapshot);
  const nodesCount = snapshot.nodes.length;
  const edgesCount = snapshot.edges.length;

  const notes: string[] = [];
  
  // Check if source exists
  if (!adj.has(src)) {
    notes.push("Account not found in current graph snapshot.");
  }

  // Get top nodes (excluding source)
  const topIds = pickTopNodes(snapshot, input).filter(id => id !== src);
  if (topIds.length === 0) {
    notes.push("Top nodes set is empty.");
  }

  // BFS with depth cap, track predecessor and bottleneck strength
  const q: string[] = [];
  const prevMap = new Map<string, PrevEntry>();
  prevMap.set(src, { prev: null, bottleneck: 1, depth: 0 });
  q.push(src);

  while (q.length > 0) {
    const cur = q.shift()!;
    const curEntry = prevMap.get(cur)!;
    
    if (curEntry.depth >= maxHops) continue;

    const neighbors = adj.get(cur) ?? [];
    for (const { to, strength_0_1 } of neighbors) {
      // Skip weak edges
      if (strength_0_1 < minStrength) continue;

      const nextDepth = curEntry.depth + 1;
      if (nextDepth > maxHops) continue;

      // Only process unvisited nodes (BFS guarantees shortest path)
      if (!prevMap.has(to)) {
        const bottleneck = Math.min(curEntry.bottleneck, strength_0_1);
        prevMap.set(to, { prev: cur, bottleneck, depth: nextDepth });
        q.push(to);
      }
    }
  }

  // Collect paths to top nodes
  const paths: HopPath[] = [];
  for (const targetId of topIds) {
    const p = reconstructPath(src, targetId, prevMap);
    if (p && p.hops >= 1 && p.hops <= maxHops) {
      paths.push(p);
    }
  }

  // Sort by hops (ascending) then strength (descending)
  paths.sort((a, b) => (a.hops - b.hops) || (b.path_strength_0_1 - a.path_strength_0_1));

  // Calculate summary statistics
  const reached = paths.length;
  const minHops = reached > 0 ? paths[0].hops : null;
  const avgHops = reached > 0 
    ? paths.reduce((sum, p) => sum + p.hops, 0) / reached 
    : null;

  // Calculate authority proximity score
  // Sum over reached top nodes: hop_weight[h] * (1 - strength_weight + strength_weight * strength)
  // Normalize by potential reach (top nodes count)
  let rawScore = 0;
  for (const p of paths) {
    const hopWeight = cfg.scoring.hop_weight[p.hops as 1 | 2 | 3] ?? 0.25;
    const mix = (1 - cfg.scoring.strength_weight) + cfg.scoring.strength_weight * p.path_strength_0_1;
    rawScore += hopWeight * mix;
  }
  const denominator = Math.max(1, topIds.length);
  const score01 = clamp01(rawScore / denominator);

  const confidence = confidenceFromGraph(nodesCount, edgesCount);

  // Compact list for UI (top 5 closest)
  const closest: ClosestTarget[] = paths.slice(0, 5).map(p => ({
    target_id: p.path[p.path.length - 1],
    hops: p.hops,
    path_strength_0_1: p.path_strength_0_1,
  }));

  // Generate explanations
  const explain = generateExplain(reached, minHops, score01, confidence);

  return {
    account_id: src,
    version: HOPS_VERSION,
    summary: {
      max_hops: maxHops,
      reachable_top_nodes: reached,
      min_hops_to_any_top: minHops,
      avg_hops_to_reached_top: avgHops ? Number(avgHops.toFixed(2)) : null,
      closest_top_targets: closest,
      authority_proximity_score_0_1: score01,
      confidence,
      notes,
    },
    paths_to_top: paths.slice(0, 30), // Limit for response size
    explain,
    meta: {
      computed_at: new Date().toISOString(),
      graph_nodes: nodesCount,
      graph_edges: edgesCount,
      top_nodes_count: topIds.length,
    },
  };
}

/**
 * Batch computation for multiple accounts
 */
export function computeHopsBatch(
  inputs: HopsInput[], 
  snapshot: GraphSnapshotLike
): {
  version: string;
  computed_at: string;
  results: HopsResult[];
  stats: {
    total: number;
    avg_proximity: number;
    well_connected_count: number;
    isolated_count: number;
  };
} {
  const results = inputs.map(input => computeHops(input, snapshot));
  
  let totalProximity = 0;
  let wellConnected = 0;
  let isolated = 0;
  
  for (const r of results) {
    totalProximity += r.summary.authority_proximity_score_0_1;
    if (r.summary.authority_proximity_score_0_1 >= 0.40) wellConnected++;
    if (r.summary.authority_proximity_score_0_1 < 0.15) isolated++;
  }

  return {
    version: HOPS_VERSION,
    computed_at: new Date().toISOString(),
    results,
    stats: {
      total: results.length,
      avg_proximity: results.length > 0 ? totalProximity / results.length : 0,
      well_connected_count: wellConnected,
      isolated_count: isolated,
    },
  };
}
