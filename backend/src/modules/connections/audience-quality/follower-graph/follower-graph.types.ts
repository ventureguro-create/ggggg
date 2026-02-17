/**
 * Follower Graph Types
 * 
 * Micro-network graph of an influencer's followers.
 * Used to detect bot clusters and manipulation patterns.
 */

export interface FollowerNode {
  id: string;           // follower id
  username?: string;
  label: 'REAL' | 'BOT' | 'SUSPICIOUS';
  clusterId?: string;
  
  // Metrics for display
  followers: number;
  following: number;
  accountAgeDays: number;
  tweets30d: number;
}

export interface FollowerEdge {
  from: string;         // follower id
  to: string;           // follower id
  type: 'SHARED_FOLLOWING' | 'TEMPORAL_SYNC' | 'SHARED_BEHAVIOR';
  weight: number;       // 0..1 edge strength
}

export interface FollowerCluster {
  clusterId: string;
  nodes: string[];      // follower ids
  size: number;
  botRatio: number;     // 0..1
  suspicious: boolean;
  avgWeight: number;
  dominantLabel: 'REAL' | 'BOT' | 'SUSPICIOUS';
}

export interface FollowerGraphResult {
  actorId: string;
  nodesCount: number;
  edgesCount: number;
  clustersCount: number;
  
  nodes: FollowerNode[];
  edges: FollowerEdge[];
  clusters: FollowerCluster[];
  
  // Summary metrics
  botClusterRatio: number;      // % of followers in bot clusters
  largestClusterSize: number;
  suspiciousClusters: number;
  
  createdAt: string;
}
