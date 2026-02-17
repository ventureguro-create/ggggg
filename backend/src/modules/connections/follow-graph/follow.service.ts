/**
 * Follow Graph v2 - Service
 * 
 * Integrates follow edges into Network v2+ graph
 */

import { Db } from 'mongodb';
import { getFollowEdges, generateMockFollowEdges } from './follow.reader.js';
import { computeFollowWeight, aggregateFollowScore } from './follow.weight.js';
import { 
  TwitterFollowEdge, 
  FollowGraphEdge, 
  FollowEdgeWithWeight,
  DEFAULT_FOLLOW_CONFIG 
} from './follow.types.js';

export interface FollowGraphParams {
  minRecencyDays?: number;
  minWeight?: number;
  limit?: number;
}

export interface FollowGraphResult {
  edges: FollowGraphEdge[];
  byTarget: Map<string, FollowEdgeWithWeight[]>; // who follows each account
  bySource: Map<string, FollowEdgeWithWeight[]>; // who each account follows
  stats: {
    totalEdges: number;
    avgWeight: number;
    maxWeight: number;
    topFollowed: { id: string; count: number; score: number }[];
  };
}

/**
 * Build follow graph with weights
 */
export async function buildFollowGraph(
  db: Db,
  accountAuthorities: Map<string, number>,
  params: FollowGraphParams = {}
): Promise<FollowGraphResult> {
  const { minRecencyDays = 365, minWeight = 0.01, limit = 500 } = params;
  
  // Get follow edges from DB
  let rawEdges = await getFollowEdges(db, { minRecencyDays, limit });
  
  // If no real data, generate mock
  if (rawEdges.length === 0) {
    console.log('[FollowGraph] No real data, generating mock edges');
    const accountIds = Array.from(accountAuthorities.keys());
    rawEdges = generateMockFollowEdges(accountIds, 100);
  }
  
  // Calculate weights
  const edgesWithWeight: FollowEdgeWithWeight[] = [];
  
  for (const edge of rawEdges) {
    const followerAuth = accountAuthorities.get(edge.fromAuthorId) ?? 0.5;
    const weight = computeFollowWeight(followerAuth, edge.followedAt);
    
    if (weight.finalWeight >= minWeight) {
      edgesWithWeight.push({
        ...edge,
        weight,
        followerAuthority: followerAuth,
      });
    }
  }
  
  // Build graph edges
  const graphEdges: FollowGraphEdge[] = edgesWithWeight.map(e => ({
    source: e.fromAuthorId,
    target: e.toAuthorId,
    type: 'FOLLOW',
    direction: 'IN',
    weight: e.weight.finalWeight,
    confidence: 0.85, // follow data is reliable
    authorityBoost: e.weight.authorityBoost,
    recencyDecay: e.weight.recencyDecay,
    followedAt: e.followedAt,
  }));
  
  // Index by target (who is followed)
  const byTarget = new Map<string, FollowEdgeWithWeight[]>();
  const bySource = new Map<string, FollowEdgeWithWeight[]>();
  
  for (const edge of edgesWithWeight) {
    if (!byTarget.has(edge.toAuthorId)) {
      byTarget.set(edge.toAuthorId, []);
    }
    byTarget.get(edge.toAuthorId)!.push(edge);
    
    if (!bySource.has(edge.fromAuthorId)) {
      bySource.set(edge.fromAuthorId, []);
    }
    bySource.get(edge.fromAuthorId)!.push(edge);
  }
  
  // Calculate stats
  const weights = graphEdges.map(e => e.weight);
  const avgWeight = weights.length > 0 
    ? weights.reduce((a, b) => a + b, 0) / weights.length 
    : 0;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
  
  // Top followed accounts
  const followCounts: { id: string; count: number; score: number }[] = [];
  for (const [id, followers] of byTarget) {
    const score = aggregateFollowScore(followers.map(f => f.weight));
    followCounts.push({ id, count: followers.length, score });
  }
  followCounts.sort((a, b) => b.score - a.score);
  
  return {
    edges: graphEdges,
    byTarget,
    bySource,
    stats: {
      totalEdges: graphEdges.length,
      avgWeight: Math.round(avgWeight * 1000) / 1000,
      maxWeight: Math.round(maxWeight * 1000) / 1000,
      topFollowed: followCounts.slice(0, 10),
    },
  };
}

/**
 * Get follow score for an account
 * 
 * Returns 0-1 score based on who follows them
 */
export function getFollowScore(
  accountId: string,
  byTarget: Map<string, FollowEdgeWithWeight[]>
): number {
  const followers = byTarget.get(accountId);
  if (!followers || followers.length === 0) return 0;
  
  return aggregateFollowScore(followers.map(f => f.weight));
}

/**
 * Get "followed by top accounts" badge
 */
export function getFollowBadge(
  accountId: string,
  byTarget: Map<string, FollowEdgeWithWeight[]>,
  threshold: number = 0.3
): { hasBadge: boolean; topFollowers: string[] } {
  const followers = byTarget.get(accountId);
  if (!followers || followers.length === 0) {
    return { hasBadge: false, topFollowers: [] };
  }
  
  // Get high-authority followers
  const topFollowers = followers
    .filter(f => f.followerAuthority > 0.7)
    .map(f => f.fromAuthorId);
  
  const score = aggregateFollowScore(followers.map(f => f.weight));
  
  return {
    hasBadge: score >= threshold,
    topFollowers: topFollowers.slice(0, 5),
  };
}
