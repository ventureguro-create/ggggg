/**
 * Network v2 - Follow Graph Reader
 * 
 * READ-ONLY interface to Twitter follow data
 * Does NOT modify Twitter collections
 * Works through the existing Twitter Adapter
 */

import type { Db, Collection } from 'mongodb';
import type {
  FollowRelationship,
  AuthorityScore,
  AuthorityTier,
  SocialPath,
  HopDistance,
  HOP_WEIGHTS,
  AUTHORITY_THRESHOLDS,
} from './network-v2.types.js';

// ============================================================
// FOLLOW GRAPH READER
// ============================================================

let db: Db | null = null;
let followsCollection: Collection | null = null;
let profilesCollection: Collection | null = null;

const FOLLOWS_COLLECTION = 'connections_follow_graph';
const NETWORK_V2_PROFILES = 'connections_network_v2_profiles';

/**
 * Initialize the Follow Graph Reader
 */
export function initFollowGraphReader(database: Db): void {
  db = database;
  followsCollection = db.collection(FOLLOWS_COLLECTION);
  profilesCollection = db.collection(NETWORK_V2_PROFILES);
  
  // Create indexes
  followsCollection.createIndex({ follower_id: 1, following_id: 1 }, { unique: true }).catch(() => {});
  followsCollection.createIndex({ following_id: 1 }).catch(() => {});
  followsCollection.createIndex({ 'follower_authority.tier': 1 }).catch(() => {});
  
  profilesCollection.createIndex({ account_id: 1 }, { unique: true }).catch(() => {});
  profilesCollection.createIndex({ 'authority.tier': 1 }).catch(() => {});
  profilesCollection.createIndex({ network_influence: -1 }).catch(() => {});
  
  console.log('[NetworkV2] Follow Graph Reader initialized');
}

// ============================================================
// AUTHORITY CALCULATION
// ============================================================

/**
 * Calculate authority score for an account
 * Based on: quality of followers, engagement patterns, network position
 */
export async function calculateAuthority(accountId: string): Promise<AuthorityScore> {
  if (!followsCollection) {
    return { tier: 'UNKNOWN', score: 0, based_on: { followers_quality: 0, engagement_quality: 0, network_position: 0 } };
  }
  
  // Get followers of this account
  const followers = await followsCollection
    .find({ following_id: accountId })
    .toArray();
  
  if (followers.length === 0) {
    return {
      tier: 'LOW',
      score: 10,
      based_on: { followers_quality: 0, engagement_quality: 0, network_position: 0 },
    };
  }
  
  // Calculate quality of followers
  let eliteCount = 0;
  let highCount = 0;
  
  for (const f of followers) {
    const tier = f.follower_authority?.tier || 'UNKNOWN';
    if (tier === 'ELITE') eliteCount++;
    else if (tier === 'HIGH') highCount++;
  }
  
  const eliteRatio = eliteCount / followers.length;
  const highRatio = highCount / followers.length;
  
  // Followers quality (0-100)
  const followersQuality = Math.min(100, 
    eliteRatio * 200 +  // Elite followers worth 2x
    highRatio * 100 +
    Math.log10(followers.length + 1) * 10
  );
  
  // Engagement quality (placeholder - would connect to actual engagement data)
  const engagementQuality = 50; // Default for now
  
  // Network position (how central in the graph)
  const networkPosition = Math.min(100, Math.log10(followers.length + 1) * 25);
  
  // Final score
  const score = Math.round(
    followersQuality * 0.5 +
    engagementQuality * 0.3 +
    networkPosition * 0.2
  );
  
  // Determine tier
  let tier: AuthorityTier = 'LOW';
  if (score >= 90) tier = 'ELITE';
  else if (score >= 70) tier = 'HIGH';
  else if (score >= 40) tier = 'MEDIUM';
  else if (score >= 10) tier = 'LOW';
  else tier = 'UNKNOWN';
  
  return {
    tier,
    score,
    based_on: {
      followers_quality: Math.round(followersQuality),
      engagement_quality: engagementQuality,
      network_position: Math.round(networkPosition),
    },
  };
}

// ============================================================
// SOCIAL DISTANCE (HOPS)
// ============================================================

/**
 * Find shortest path between two accounts in the follow graph
 * Uses BFS with max depth of 3 hops
 */
export async function findSocialPath(
  fromId: string,
  toId: string,
  maxHops: number = 3
): Promise<SocialPath | null> {
  if (!followsCollection) return null;
  
  // BFS to find shortest path
  const visited = new Set<string>();
  const queue: { id: string; path: string[]; depth: number }[] = [
    { id: fromId, path: [fromId], depth: 0 }
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.id === toId) {
      const hops = (current.depth as HopDistance) || 'DISTANT';
      return {
        from_id: fromId,
        to_id: toId,
        hops: Math.min(current.depth, 3) as HopDistance || 'DISTANT',
        path: current.path,
        path_authority: 50, // Would calculate based on actual authority
        signal_strength: getHopWeight(hops),
      };
    }
    
    if (current.depth >= maxHops) continue;
    if (visited.has(current.id)) continue;
    
    visited.add(current.id);
    
    // Get accounts this person follows
    const following = await followsCollection
      .find({ follower_id: current.id })
      .limit(100)
      .toArray();
    
    for (const f of following) {
      if (!visited.has(f.following_id)) {
        queue.push({
          id: f.following_id,
          path: [...current.path, f.following_id],
          depth: current.depth + 1,
        });
      }
    }
  }
  
  return null;
}

function getHopWeight(hops: HopDistance | number): number {
  if (hops === 1) return 1.0;
  if (hops === 2) return 0.5;
  if (hops === 3) return 0.2;
  return 0.05;
}

// ============================================================
// ELITE EXPOSURE
// ============================================================

/**
 * Calculate elite exposure for an account
 * What % of followers are elite/high tier
 */
export async function calculateEliteExposure(accountId: string): Promise<{
  total_followers: number;
  elite_followers: number;
  high_followers: number;
  elite_percentage: number;
  exposure_score: number;
}> {
  if (!followsCollection) {
    return { total_followers: 0, elite_followers: 0, high_followers: 0, elite_percentage: 0, exposure_score: 0 };
  }
  
  const pipeline = [
    { $match: { following_id: accountId } },
    {
      $group: {
        _id: '$follower_authority.tier',
        count: { $sum: 1 },
      },
    },
  ];
  
  const results = await followsCollection.aggregate(pipeline).toArray();
  
  let total = 0;
  let elite = 0;
  let high = 0;
  
  for (const r of results) {
    total += r.count;
    if (r._id === 'ELITE') elite = r.count;
    else if (r._id === 'HIGH') high = r.count;
  }
  
  const elitePercentage = total > 0 ? (elite / total) * 100 : 0;
  const highPercentage = total > 0 ? (high / total) * 100 : 0;
  
  // Exposure score weights elite heavily
  const exposureScore = Math.min(100, elitePercentage * 3 + highPercentage * 1.5);
  
  return {
    total_followers: total,
    elite_followers: elite,
    high_followers: high,
    elite_percentage: Math.round(elitePercentage * 10) / 10,
    exposure_score: Math.round(exposureScore),
  };
}

// ============================================================
// FOLLOW DATA INGESTION
// ============================================================

/**
 * Add a follow relationship to the graph
 * This is the ONLY write operation - for building the graph
 */
export async function addFollowRelationship(
  followerId: string,
  followingId: string,
  followerAuthority?: AuthorityScore
): Promise<void> {
  if (!followsCollection) return;
  
  const relationship: FollowRelationship = {
    follower_id: followerId,
    following_id: followingId,
    follower_authority: followerAuthority || {
      tier: 'UNKNOWN',
      score: 0,
      based_on: { followers_quality: 0, engagement_quality: 0, network_position: 0 },
    },
    discovered_at: new Date().toISOString(),
    last_verified: new Date().toISOString(),
    weight: getAuthorityWeight(followerAuthority?.tier || 'UNKNOWN'),
  };
  
  await followsCollection.updateOne(
    { follower_id: followerId, following_id: followingId },
    { $set: relationship },
    { upsert: true }
  );
}

function getAuthorityWeight(tier: AuthorityTier): number {
  switch (tier) {
    case 'ELITE': return 3.0;
    case 'HIGH': return 2.0;
    case 'MEDIUM': return 1.0;
    case 'LOW': return 0.5;
    default: return 0.3;
  }
}

// ============================================================
// GRAPH STATISTICS
// ============================================================

export async function getGraphStats(): Promise<{
  total_relationships: number;
  unique_accounts: number;
  by_tier: Record<string, number>;
}> {
  if (!followsCollection) {
    return { total_relationships: 0, unique_accounts: 0, by_tier: {} };
  }
  
  const totalRelationships = await followsCollection.countDocuments();
  
  // Get unique accounts
  const uniqueFollowers = await followsCollection.distinct('follower_id');
  const uniqueFollowing = await followsCollection.distinct('following_id');
  const uniqueAccounts = new Set([...uniqueFollowers, ...uniqueFollowing]).size;
  
  // By tier
  const tierPipeline = [
    { $group: { _id: '$follower_authority.tier', count: { $sum: 1 } } },
  ];
  const tierResults = await followsCollection.aggregate(tierPipeline).toArray();
  const byTier: Record<string, number> = {};
  for (const r of tierResults) byTier[r._id || 'UNKNOWN'] = r.count;
  
  return {
    total_relationships: totalRelationships,
    unique_accounts: uniqueAccounts,
    by_tier: byTier,
  };
}

console.log('[NetworkV2] Follow Graph Reader module loaded');
