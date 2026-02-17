/**
 * Authority Engine
 * 
 * PageRank-like algorithm for computing network authority scores
 * 
 * Key concepts:
 * - Authority flows through edges
 * - Strong nodes amplify their neighbors
 * - Weak nodes transfer little weight
 * - Dangling nodes distribute uniformly
 */

import { authorityConfig as cfg } from './authority-config.js';
import { AuthorityGraphSnapshot, AuthorityResult } from './authority-types.js';
import { buildWeightedAdj } from './authority-graph-adapter.js';
import { normalizeScores } from './authority-normalize.js';

/**
 * L1 norm delta between two score distributions
 */
function l1Delta(a: Record<string, number>, b: Record<string, number>): number {
  let d = 0;
  for (const k of Object.keys(a)) {
    d += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  }
  return d;
}

/**
 * Compute authority scores using PageRank-like algorithm
 * 
 * @param snapshot - Graph snapshot with nodes and edges
 * @returns Authority result with normalized scores and stats
 */
export function computeAuthority(snapshot: AuthorityGraphSnapshot): AuthorityResult {
  const n = snapshot.nodes.length;
  const ids = snapshot.nodes.map(x => x.id);

  // Build weighted adjacency list
  const adj = buildWeightedAdj(snapshot);

  // Initialize uniform distribution
  let rank: Record<string, number> = {};
  const init = n ? (1 / n) : 0;
  for (const id of ids) {
    rank[id] = init;
  }

  const damping = cfg.damping;
  const teleport = n ? ((1 - damping) / n) : 0;

  let converged = false;
  let lastDelta = 0;
  let itUsed = 0;

  // Iterative computation
  for (let it = 0; it < cfg.iterations; it++) {
    itUsed = it + 1;
    const next: Record<string, number> = {};
    
    // Start with teleport probability
    for (const id of ids) {
      next[id] = teleport;
    }

    // Distribute rank mass through edges
    for (const id of ids) {
      const out = adj.get(id) ?? [];
      
      if (out.length === 0) {
        // Dangling node: distribute uniformly to all nodes
        const share = n ? (damping * rank[id] / n) : 0;
        for (const k of ids) {
          next[k] += share;
        }
      } else {
        // Normal node: distribute through edges
        for (const { to, w } of out) {
          next[to] += damping * rank[id] * w;
        }
      }
    }

    lastDelta = l1Delta(rank, next);
    rank = next;

    // Early stop if converged
    if (lastDelta < cfg.tolerance) {
      converged = true;
      break;
    }
  }

  // Normalize to 0..1 for product use
  const norm = normalizeScores(rank, cfg.normalize.method, cfg.normalize.clamp);

  return {
    version: cfg.version,
    scores_0_1: norm,
    stats: {
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      iterations: itUsed,
      converged,
      last_delta: Number(lastDelta.toFixed(10)),
    },
  };
}

/**
 * Compute authority for a single node (requires full graph computation)
 */
export function computeAuthorityForNode(
  nodeId: string,
  snapshot: AuthorityGraphSnapshot
): { score: number; rank: number; percentile: number } | null {
  const result = computeAuthority(snapshot);
  
  const score = result.scores_0_1[nodeId];
  if (score === undefined) {
    return null;
  }
  
  // Calculate rank and percentile
  const allScores = Object.values(result.scores_0_1);
  const sortedScores = [...allScores].sort((a, b) => b - a);
  const rank = sortedScores.indexOf(score) + 1;
  const percentile = (1 - (rank / sortedScores.length)) * 100;
  
  return {
    score,
    rank,
    percentile: Number(percentile.toFixed(1)),
  };
}

/**
 * Get top N authorities from result
 */
export function getTopAuthorities(
  result: AuthorityResult,
  limit: number = 10
): Array<{ id: string; score: number; rank: number }> {
  const entries = Object.entries(result.scores_0_1);
  entries.sort((a, b) => b[1] - a[1]);
  
  return entries.slice(0, limit).map(([id, score], idx) => ({
    id,
    score: Number(score.toFixed(4)),
    rank: idx + 1,
  }));
}
