/**
 * Build Network - Network v2 Co-Engagement
 * 
 * Builds edges between authors based on similarity
 */

import type { AuthorActivityVector, CoEngagementEdge, CoEngagementConfig, CoEngagementResult } from './co-engagement.types.js';
import { mapSimilarity, temporalSync } from './similarity.js';

/**
 * Build co-engagement network from activity vectors
 */
export function buildCoEngagementNetwork(
  vectors: Map<string, AuthorActivityVector>,
  cfg: CoEngagementConfig
): CoEngagementResult {
  const authors = Array.from(vectors.keys());
  const edgeCandidates: CoEngagementEdge[] = [];
  
  // Compare all pairs (O(n²) but capped by max_nodes)
  for (let i = 0; i < authors.length; i++) {
    for (let j = i + 1; j < authors.length; j++) {
      const idA = authors[i];
      const idB = authors[j];
      const vecA = vectors.get(idA)!;
      const vecB = vectors.get(idB)!;
      
      // Calculate similarity on reply patterns
      const replySim = mapSimilarity(
        vecA.replied_to_authors,
        vecB.replied_to_authors,
        cfg.similarity_method
      );
      
      // Calculate temporal sync
      const tempSync = temporalSync(
        vecA.hourly_activity,
        vecB.hourly_activity,
        vecA.daily_activity,
        vecB.daily_activity
      );
      
      // Combined similarity (reply patterns + temporal)
      const combinedSim = replySim.similarity * 0.7 + tempSync * 0.3;
      
      // Skip if below threshold
      if (combinedSim < cfg.min_similarity) continue;
      
      // Calculate confidence
      const sharedCount = replySim.shared_keys.length;
      if (sharedCount < cfg.min_shared_interactions) continue;
      
      let confidence = Math.min(0.95, 0.5 + sharedCount * 0.05);
      if (tempSync > 0.6) {
        confidence = Math.min(0.95, confidence + cfg.confidence_boost_for_temporal_sync);
      }
      
      edgeCandidates.push({
        source_id: idA,
        target_id: idB,
        similarity: combinedSim,
        shared_interactions: sharedCount,
        co_liked_authors: [], // Would need more data
        co_replied_authors: replySim.shared_keys,
        temporal_sync: tempSync,
        confidence,
        computed_at: new Date().toISOString(),
      });
    }
  }
  
  // Sort by similarity descending
  edgeCandidates.sort((a, b) => b.similarity - a.similarity);
  
  // Apply topK per node limit
  const perNodeCount = new Map<string, number>();
  const finalEdges: CoEngagementEdge[] = [];
  
  for (const edge of edgeCandidates) {
    const countA = perNodeCount.get(edge.source_id) || 0;
    const countB = perNodeCount.get(edge.target_id) || 0;
    
    if (countA >= cfg.top_k_per_node || countB >= cfg.top_k_per_node) {
      continue;
    }
    
    finalEdges.push(edge);
    perNodeCount.set(edge.source_id, countA + 1);
    perNodeCount.set(edge.target_id, countB + 1);
    
    if (finalEdges.length >= cfg.max_edges) break;
  }
  
  // Extract nodes from final edges
  const nodeSet = new Set<string>();
  for (const edge of finalEdges) {
    nodeSet.add(edge.source_id);
    nodeSet.add(edge.target_id);
  }
  
  // Calculate stats
  const avgSim = finalEdges.length > 0
    ? finalEdges.reduce((sum, e) => sum + e.similarity, 0) / finalEdges.length
    : 0;
  const avgConf = finalEdges.length > 0
    ? finalEdges.reduce((sum, e) => sum + e.confidence, 0) / finalEdges.length
    : 0;
  
  return {
    edges: finalEdges,
    nodes: Array.from(nodeSet),
    stats: {
      total_nodes: nodeSet.size,
      total_edges: finalEdges.length,
      avg_similarity: Math.round(avgSim * 1000) / 1000,
      avg_confidence: Math.round(avgConf * 1000) / 1000,
      clusters_detected: 0, // Would need cluster detection
      window_days: cfg.window_days,
      computed_at: new Date().toISOString(),
    },
  };
}

/**
 * Simple cluster detection using connected components
 */
export function detectClusters(edges: CoEngagementEdge[]): Map<string, number> {
  const clusters = new Map<string, number>();
  const parent = new Map<string, string>();
  
  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }
  
  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  }
  
  // Union all edges
  for (const edge of edges) {
    union(edge.source_id, edge.target_id);
  }
  
  // Assign cluster IDs
  const rootToCluster = new Map<string, number>();
  let nextCluster = 0;
  
  for (const node of parent.keys()) {
    const root = find(node);
    if (!rootToCluster.has(root)) {
      rootToCluster.set(root, nextCluster++);
    }
    clusters.set(node, rootToCluster.get(root)!);
  }
  
  return clusters;
}

console.log('[CoEngagement] Build Network module loaded');
