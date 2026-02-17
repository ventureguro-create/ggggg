/**
 * Twitter Live Reader (Phase 4.2)
 * 
 * Read-only access to Twitter Parser storage.
 * NO WRITES. NO SIDE-EFFECTS. NO ALERTS.
 */

import { Db, Collection } from 'mongodb';
import { getTwitterLiveConfig } from './config.js';
import type { TwitterAuthorSnapshot, TwitterEngagementEvent, TwitterFollowEdge } from '../adapters/twitter/contracts/index.js';

export interface TwitterLiveReadResult {
  success: boolean;
  mode: string;
  error?: string;
  
  // Counts
  authors_count: number;
  engagements_count: number;
  edges_count: number;
  
  // Data
  authors: TwitterAuthorSnapshot[];
  engagements: TwitterEngagementEvent[];
  edges: TwitterFollowEdge[];
  
  // Meta
  freshness: {
    oldest_data?: Date;
    newest_data?: Date;
    avg_age_hours: number;
  };
  
  warnings: string[];
}

/**
 * Read authors from Twitter storage
 */
async function readAuthors(
  db: Db,
  limit: number,
  maxAgeHours: number
): Promise<{ authors: TwitterAuthorSnapshot[]; warnings: string[] }> {
  const config = getTwitterLiveConfig();
  const warnings: string[] = [];
  const authors: TwitterAuthorSnapshot[] = [];
  
  try {
    const collection = db.collection(config.collections.authors);
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    // Read with freshness filter
    const cursor = collection.find({
      collected_at: { $gte: cutoff }
    }).sort({ collected_at: -1 }).limit(limit);
    
    const docs = await cursor.toArray();
    
    for (const doc of docs) {
      authors.push({
        author_id: doc.author_id || doc.user_id || String(doc._id),
        username: doc.username || doc.screen_name || doc.handle || 'unknown',
        display_name: doc.display_name || doc.name,
        followers: doc.followers || doc.followers_count || 0,
        following: doc.following || doc.friends_count || 0,
        verified: doc.verified || false,
        avatar_url: doc.avatar_url || doc.profile_image_url,
        account_created_at: doc.account_created_at ? new Date(doc.account_created_at) : undefined,
        collected_at: doc.collected_at ? new Date(doc.collected_at) : new Date(),
        source_session_id: doc.session_id,
        source_task_id: doc.task_id,
      });
    }
    
    if (authors.length === 0) {
      warnings.push('No fresh author data found');
    }
  } catch (err: any) {
    warnings.push(`Failed to read authors: ${err.message}`);
  }
  
  return { authors, warnings };
}

/**
 * Read engagements from Twitter storage
 */
async function readEngagements(
  db: Db,
  authorIds: string[],
  maxAgeHours: number
): Promise<{ engagements: TwitterEngagementEvent[]; warnings: string[] }> {
  const config = getTwitterLiveConfig();
  const warnings: string[] = [];
  const engagements: TwitterEngagementEvent[] = [];
  
  if (authorIds.length === 0) {
    return { engagements, warnings };
  }
  
  try {
    const collection = db.collection(config.collections.engagements);
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    const cursor = collection.find({
      author_id: { $in: authorIds },
      collected_at: { $gte: cutoff }
    }).sort({ collected_at: -1 }).limit(1000);
    
    const docs = await cursor.toArray();
    
    for (const doc of docs) {
      engagements.push({
        author_id: doc.author_id,
        tweet_id: doc.tweet_id || String(doc._id),
        likes: doc.likes || doc.favorite_count || 0,
        reposts: doc.reposts || doc.retweet_count || 0,
        replies: doc.replies || doc.reply_count || 0,
        views: doc.views || doc.impression_count,
        posted_at: doc.posted_at ? new Date(doc.posted_at) : new Date(),
        collected_at: doc.collected_at ? new Date(doc.collected_at) : new Date(),
      });
    }
    
    if (engagements.length === 0 && authorIds.length > 0) {
      warnings.push('No engagement data found for authors');
    }
  } catch (err: any) {
    warnings.push(`Failed to read engagements: ${err.message}`);
  }
  
  return { engagements, warnings };
}

/**
 * Read follow edges from Twitter storage
 */
async function readFollowEdges(
  db: Db,
  authorIds: string[],
  maxEdgesPerAccount: number
): Promise<{ edges: TwitterFollowEdge[]; warnings: string[] }> {
  const config = getTwitterLiveConfig();
  const warnings: string[] = [];
  const edges: TwitterFollowEdge[] = [];
  
  if (authorIds.length === 0) {
    return { edges, warnings };
  }
  
  try {
    const collection = db.collection(config.collections.follow_edges);
    
    // Get edges where author is either follower or followee
    const cursor = collection.find({
      $or: [
        { from_id: { $in: authorIds } },
        { to_id: { $in: authorIds } }
      ]
    }).limit(authorIds.length * maxEdgesPerAccount);
    
    const docs = await cursor.toArray();
    
    for (const doc of docs) {
      edges.push({
        from_id: doc.from_id || doc.follower_id,
        to_id: doc.to_id || doc.followed_id,
        from_username: doc.from_username,
        to_username: doc.to_username,
        weight: doc.weight || 1.0,
        discovered_at: doc.discovered_at ? new Date(doc.discovered_at) : new Date(),
      });
    }
    
    if (edges.length === 0 && authorIds.length > 0) {
      warnings.push('No follow graph data found');
    }
  } catch (err: any) {
    warnings.push(`Failed to read follow edges: ${err.message}`);
  }
  
  return { edges, warnings };
}

/**
 * Main read function - READ ONLY
 */
export async function readTwitterLiveData(
  db: Db,
  options?: {
    author_ids?: string[];
    limit?: number;
  }
): Promise<TwitterLiveReadResult> {
  const config = getTwitterLiveConfig();
  
  const result: TwitterLiveReadResult = {
    success: false,
    mode: config.mode,
    authors_count: 0,
    engagements_count: 0,
    edges_count: 0,
    authors: [],
    engagements: [],
    edges: [],
    freshness: { avg_age_hours: 0 },
    warnings: [],
  };
  
  // Check if enabled
  if (!config.enabled || config.mode === 'off') {
    result.warnings.push('Twitter Live is disabled');
    return result;
  }
  
  const limit = options?.limit || config.max_accounts_per_batch;
  
  // 1. Read authors
  const authorsResult = await readAuthors(db, limit, config.max_age_hours);
  result.authors = authorsResult.authors;
  result.authors_count = authorsResult.authors.length;
  result.warnings.push(...authorsResult.warnings);
  
  // Get author IDs (from input or from read data)
  const authorIds = options?.author_ids || result.authors.map(a => a.author_id);
  
  // 2. Read engagements
  const engagementsResult = await readEngagements(db, authorIds, config.max_age_hours);
  result.engagements = engagementsResult.engagements;
  result.engagements_count = engagementsResult.engagements.length;
  result.warnings.push(...engagementsResult.warnings);
  
  // 3. Read follow edges
  const edgesResult = await readFollowEdges(db, authorIds, config.max_edges_per_account);
  result.edges = edgesResult.edges;
  result.edges_count = edgesResult.edges.length;
  result.warnings.push(...edgesResult.warnings);
  
  // Calculate freshness
  const allDates: Date[] = [
    ...result.authors.map(a => a.collected_at),
    ...result.engagements.map(e => e.collected_at),
  ];
  
  if (allDates.length > 0) {
    const now = Date.now();
    const totalAgeMs = allDates.reduce((sum, d) => sum + (now - d.getTime()), 0);
    result.freshness = {
      oldest_data: new Date(Math.min(...allDates.map(d => d.getTime()))),
      newest_data: new Date(Math.max(...allDates.map(d => d.getTime()))),
      avg_age_hours: totalAgeMs / allDates.length / (1000 * 60 * 60),
    };
  }
  
  result.success = true;
  console.log(`[TwitterLive] Read ${result.authors_count} authors, ${result.engagements_count} engagements, ${result.edges_count} edges`);
  
  return result;
}
