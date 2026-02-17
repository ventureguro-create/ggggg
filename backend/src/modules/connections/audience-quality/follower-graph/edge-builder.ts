/**
 * Follower Graph Edge Builder
 * 
 * Builds edges between followers based on:
 * 1. SHARED_FOLLOWING - follow same accounts
 * 2. TEMPORAL_SYNC - followed at same time (within 12h)
 * 3. SHARED_BEHAVIOR - similar activity patterns
 */

import type { FollowerEdge } from './follower-graph.types.js';
import type { AQEFollowerClassified } from '../contracts/audienceQuality.types.js';

/**
 * Build edges based on shared following patterns
 * 
 * If two followers follow many of the same accounts,
 * they're likely from the same bot farm.
 * 
 * weight = overlap / min(followingA, followingB)
 */
export function buildSharedFollowingEdges(
  followers: AQEFollowerClassified[],
  followingData?: Map<string, string[]>  // followerId -> list of accounts they follow
): FollowerEdge[] {
  if (!followingData || followingData.size === 0) return [];
  
  const edges: FollowerEdge[] = [];
  const ids = followers.map(f => f.followerId);
  
  for (let i = 0; i < ids.length; i++) {
    const aFollowing = followingData.get(ids[i]);
    if (!aFollowing || aFollowing.length === 0) continue;
    
    for (let j = i + 1; j < ids.length; j++) {
      const bFollowing = followingData.get(ids[j]);
      if (!bFollowing || bFollowing.length === 0) continue;
      
      // Calculate overlap
      const aSet = new Set(aFollowing);
      const overlap = bFollowing.filter(x => aSet.has(x)).length;
      
      if (overlap < 5) continue;  // minimum threshold
      
      const minFollowing = Math.min(aFollowing.length, bFollowing.length);
      const weight = overlap / minFollowing;
      
      if (weight >= 0.3) {  // 30%+ overlap
        edges.push({
          from: ids[i],
          to: ids[j],
          type: 'SHARED_FOLLOWING',
          weight: Math.round(weight * 100) / 100,
        });
      }
    }
  }
  
  return edges;
}

/**
 * Build edges based on temporal synchronization
 * 
 * If followers joined around the same time (within 12h window),
 * they're likely from a coordinated campaign.
 * 
 * weight = exp(-Δt / 12h)
 */
export function buildTemporalSyncEdges(
  followers: AQEFollowerClassified[],
  followTimes?: Map<string, Date>  // followerId -> when they followed the influencer
): FollowerEdge[] {
  if (!followTimes || followTimes.size === 0) return [];
  
  const edges: FollowerEdge[] = [];
  const ids = followers.map(f => f.followerId);
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  
  for (let i = 0; i < ids.length; i++) {
    const aTime = followTimes.get(ids[i]);
    if (!aTime) continue;
    
    for (let j = i + 1; j < ids.length; j++) {
      const bTime = followTimes.get(ids[j]);
      if (!bTime) continue;
      
      const delta = Math.abs(aTime.getTime() - bTime.getTime());
      
      if (delta <= TWELVE_HOURS_MS) {
        const weight = Math.exp(-delta / TWELVE_HOURS_MS);
        
        if (weight >= 0.5) {  // strong temporal correlation
          edges.push({
            from: ids[i],
            to: ids[j],
            type: 'TEMPORAL_SYNC',
            weight: Math.round(weight * 100) / 100,
          });
        }
      }
    }
  }
  
  return edges;
}

/**
 * Build edges based on behavior similarity
 * 
 * Similar activity patterns (age, tweets, follow ratio) suggest automation.
 */
export function buildBehaviorEdges(
  followers: AQEFollowerClassified[]
): FollowerEdge[] {
  const edges: FollowerEdge[] = [];
  
  // Only consider suspicious followers
  const suspicious = followers.filter(
    f => f.label === 'BOT_LIKELY' || f.label === 'FARM_NODE'
  );
  
  for (let i = 0; i < suspicious.length; i++) {
    const a = suspicious[i];
    
    for (let j = i + 1; j < suspicious.length; j++) {
      const b = suspicious[j];
      
      // Compare feature similarity
      const ageSim = 1 - Math.abs(a.features.account_age_days - b.features.account_age_days) / 
                         Math.max(a.features.account_age_days, b.features.account_age_days, 1);
      const tweetsSim = 1 - Math.abs(a.features.tweets_total - b.features.tweets_total) / 
                            Math.max(a.features.tweets_total, b.features.tweets_total, 1);
      const ratioSim = 1 - Math.abs(a.features.follow_ratio - b.features.follow_ratio) / 
                           Math.max(a.features.follow_ratio, b.features.follow_ratio, 1);
      
      const avgSim = (ageSim + tweetsSim + ratioSim) / 3;
      
      if (avgSim >= 0.8) {  // 80%+ similarity
        edges.push({
          from: a.followerId,
          to: b.followerId,
          type: 'SHARED_BEHAVIOR',
          weight: Math.round(avgSim * 100) / 100,
        });
      }
    }
  }
  
  return edges;
}
