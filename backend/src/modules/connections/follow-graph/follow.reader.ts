/**
 * Follow Graph v2 - Reader
 * 
 * Reads follow edges from twitter_follows collection or generates mock
 */

import { Db } from 'mongodb';
import { TwitterFollowEdge } from './follow.types.js';

export interface GetFollowEdgesParams {
  since?: Date;           // only edges parsed after this
  minRecencyDays?: number; // only edges followed within N days
  limit?: number;
}

/**
 * Read follow edges from database
 */
export async function getFollowEdges(
  db: Db,
  params: GetFollowEdgesParams = {}
): Promise<TwitterFollowEdge[]> {
  const { since, minRecencyDays = 365, limit = 1000 } = params;
  
  const collection = db.collection('twitter_follows');
  
  // Build query
  const query: any = {};
  
  if (since) {
    query.parsedAt = { $gte: since };
  }
  
  if (minRecencyDays) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - minRecencyDays);
    query.followedAt = { $gte: minDate };
  }
  
  // Note: removed 1-hour safety check for development - fresh data is allowed
  
  console.log(`[FollowReader] Query:`, JSON.stringify(query));
  
  try {
    // First check total count
    const totalCount = await collection.countDocuments({});
    console.log(`[FollowReader] Total documents in twitter_follows: ${totalCount}`);
    
    const edges = await collection
      .find(query)
      .sort({ parsedAt: -1 })
      .limit(limit)
      .toArray();
    
    console.log(`[FollowReader] Found ${edges.length} edges in twitter_follows`);
    
    return edges.map(e => ({
      fromAuthorId: e.fromAuthorId || e.followerId,
      toAuthorId: e.toAuthorId || e.followedId,
      followedAt: e.followedAt ? new Date(e.followedAt) : new Date(),
      parsedAt: e.parsedAt ? new Date(e.parsedAt) : new Date(),
      source: 'twitter' as const,
    }));
  } catch (err) {
    console.log('[FollowReader] No twitter_follows collection, returning empty');
    return [];
  }
}

/**
 * Generate mock follow edges for testing
 */
export function generateMockFollowEdges(
  accountIds: string[],
  count: number = 50
): TwitterFollowEdge[] {
  const edges: TwitterFollowEdge[] = [];
  const now = new Date();
  
  // Generate realistic follow patterns
  // Top accounts get followed by many, small accounts follow many
  const topAccounts = accountIds.filter(id => 
    id.includes('a16z') || id.includes('paradigm') || id.includes('sequoia') ||
    id.includes('binance') || id.includes('polychain') || id.includes('inf1')
  );
  
  const regularAccounts = accountIds.filter(id => !topAccounts.includes(id));
  
  // Top accounts follow each other (high value)
  for (let i = 0; i < topAccounts.length; i++) {
    for (let j = i + 1; j < topAccounts.length; j++) {
      if (Math.random() > 0.6) {
        const followedAt = new Date(now);
        followedAt.setDate(followedAt.getDate() - Math.floor(Math.random() * 180));
        
        edges.push({
          fromAuthorId: topAccounts[i],
          toAuthorId: topAccounts[j],
          followedAt,
          parsedAt: now,
          source: 'mock',
        });
      }
    }
  }
  
  // Regular accounts follow top accounts
  for (const regular of regularAccounts) {
    const numFollows = Math.floor(1 + Math.random() * 3);
    const shuffled = [...topAccounts].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(numFollows, shuffled.length); i++) {
      const followedAt = new Date(now);
      followedAt.setDate(followedAt.getDate() - Math.floor(Math.random() * 365));
      
      edges.push({
        fromAuthorId: regular,
        toAuthorId: shuffled[i],
        followedAt,
        parsedAt: now,
        source: 'mock',
      });
    }
  }
  
  // Some top accounts follow interesting smaller accounts
  for (const top of topAccounts) {
    if (Math.random() > 0.7) {
      const target = regularAccounts[Math.floor(Math.random() * regularAccounts.length)];
      if (target) {
        const followedAt = new Date(now);
        followedAt.setDate(followedAt.getDate() - Math.floor(Math.random() * 90));
        
        edges.push({
          fromAuthorId: top,
          toAuthorId: target,
          followedAt,
          parsedAt: now,
          source: 'mock',
        });
      }
    }
  }
  
  return edges.slice(0, count);
}
