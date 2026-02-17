/**
 * Follower Graph Service
 * 
 * Builds and analyzes the follower micro-network graph.
 */

import type { FollowerGraphResult, FollowerNode } from './follower-graph.types.js';
import type { AQEFollowerClassified } from '../contracts/audienceQuality.types.js';
import { buildBehaviorEdges } from './edge-builder.js';
import { detectClusters } from './cluster-detector.js';

/**
 * Build follower graph from classified followers
 */
export function buildFollowerGraph(
  actorId: string,
  classified: AQEFollowerClassified[]
): FollowerGraphResult {
  // Build nodes
  const nodes: FollowerNode[] = classified.map(f => ({
    id: f.followerId,
    username: f.username,
    label: f.label === 'BOT_LIKELY' || f.label === 'FARM_NODE' ? 'BOT' :
           f.label === 'LOW_QUALITY' ? 'SUSPICIOUS' : 'REAL',
    followers: f.features.followers_count,
    following: f.features.following_count,
    accountAgeDays: f.features.account_age_days,
    tweets30d: f.features.tweets_last_30d,
  }));

  // Build edges (using behavior similarity since we don't have following data)
  const edges = buildBehaviorEdges(classified);

  // Detect clusters
  const clusters = detectClusters(classified, edges);

  // Assign cluster IDs to nodes
  const nodeClusterMap = new Map<string, string>();
  for (const cluster of clusters) {
    for (const nodeId of cluster.nodes) {
      nodeClusterMap.set(nodeId, cluster.clusterId);
    }
  }
  
  for (const node of nodes) {
    node.clusterId = nodeClusterMap.get(node.id);
  }

  // Calculate summary metrics
  const nodesInBotClusters = clusters
    .filter(c => c.suspicious)
    .reduce((sum, c) => sum + c.size, 0);
  
  const botClusterRatio = nodes.length > 0 ? nodesInBotClusters / nodes.length : 0;
  const largestClusterSize = clusters.length > 0 ? Math.max(...clusters.map(c => c.size)) : 0;
  const suspiciousClusters = clusters.filter(c => c.suspicious).length;

  return {
    actorId,
    nodesCount: nodes.length,
    edgesCount: edges.length,
    clustersCount: clusters.length,
    
    nodes,
    edges,
    clusters,
    
    botClusterRatio: Math.round(botClusterRatio * 100) / 100,
    largestClusterSize,
    suspiciousClusters,
    
    createdAt: new Date().toISOString(),
  };
}

/**
 * Calculate bot pressure penalty from graph
 * 
 * Large bot clusters = higher penalty
 */
export function calculateGraphPenalty(graph: FollowerGraphResult): {
  penalty: number;
  reason: string;
} {
  let penalty = 1.0;
  const reasons: string[] = [];

  // Penalty for bot cluster ratio
  if (graph.botClusterRatio > 0.3) {
    penalty *= 0.7;
    reasons.push(`HIGH_BOT_CLUSTER_RATIO(${Math.round(graph.botClusterRatio * 100)}%)`);
  } else if (graph.botClusterRatio > 0.15) {
    penalty *= 0.85;
    reasons.push(`MODERATE_BOT_CLUSTER_RATIO(${Math.round(graph.botClusterRatio * 100)}%)`);
  }

  // Penalty for large suspicious clusters
  if (graph.largestClusterSize >= 20) {
    penalty *= 0.75;
    reasons.push(`LARGE_CLUSTER(${graph.largestClusterSize})`);
  } else if (graph.largestClusterSize >= 10) {
    penalty *= 0.9;
    reasons.push(`MEDIUM_CLUSTER(${graph.largestClusterSize})`);
  }

  // Penalty for many suspicious clusters
  if (graph.suspiciousClusters >= 5) {
    penalty *= 0.8;
    reasons.push(`MANY_SUSPICIOUS_CLUSTERS(${graph.suspiciousClusters})`);
  }

  return {
    penalty: Math.round(penalty * 100) / 100,
    reason: reasons.length ? reasons.join(', ') : 'OK',
  };
}
