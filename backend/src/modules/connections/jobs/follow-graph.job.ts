/**
 * Follow Graph Auto-Parse Job
 * 
 * Periodically parses followers for top influencers to build the follow graph.
 * Self-contained within the connections module.
 */

import { getConnectionsDb, getConnectionsPorts } from '../module.js';
import { COLLECTIONS } from '../config/connections.config.js';

const UNIFIED_ACCOUNTS = COLLECTIONS.UNIFIED_ACCOUNTS;
const FOLLOW_GRAPH = COLLECTIONS.FOLLOW_GRAPH;

let lastRunAt: Date | null = null;
let isRunning = false;
let lastError: string | null = null;
let totalParsed = 0;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Parse followers for a single account (uses TwitterParser port if available)
 */
async function parseAccountFollowers(
  db: any, 
  account: any, 
  limit: number = 100
): Promise<{ followers: any[]; saved: number }> {
  const username = account.handle?.replace('@', '') || account.title;
  
  if (!username) {
    return { followers: [], saved: 0 };
  }
  
  try {
    console.log(`[FollowGraphJob] Parsing followers for @${username}...`);
    
    const ports = getConnectionsPorts();
    
    // Try to get followers from parser port
    let followers: any[] = [];
    
    if (ports.twitterParser) {
      followers = await ports.twitterParser.getFollowerEdges(account.id || username);
    }
    
    // If no parser port or no results, use fallback
    if (!followers.length) {
      // Try to use execution adapter directly (fallback)
      try {
        const { twitterExecutionAdapter } = await import('../../twitter/execution/execution.adapter.js');
        const result = await twitterExecutionAdapter.getFollowers(username, limit);
        
        if (result.ok && result.data?.followers?.length) {
          followers = result.data.followers;
        }
      } catch (importErr) {
        console.warn(`[FollowGraphJob] Twitter adapter not available for @${username}`);
        return { followers: [], saved: 0 };
      }
    }
    
    if (!followers.length) {
      console.log(`[FollowGraphJob] No followers data for @${username}`);
      return { followers: [], saved: 0 };
    }
    
    const now = new Date();
    
    // Get existing unified accounts to match followers
    const allAccounts = await db.collection(UNIFIED_ACCOUNTS).find({}).toArray();
    const accountByHandle = new Map<string, any>();
    for (const acc of allAccounts) {
      const handle = acc.handle?.replace('@', '').toLowerCase();
      if (handle) accountByHandle.set(handle, acc);
    }
    
    // Save follow edges to follow graph collection
    const followGraphCol = db.collection(FOLLOW_GRAPH);
    let saved = 0;
    
    for (const follower of followers) {
      const followerHandle = (follower.username || follower.handle || '').toLowerCase().replace('@', '');
      const matchedAccount = accountByHandle.get(followerHandle);
      
      // Create follow edge
      const edge = {
        fromAuthorId: matchedAccount?.id || `tw:${follower.id || followerHandle}`,
        fromUsername: follower.username || followerHandle,
        fromName: follower.name || follower.displayName || '',
        fromFollowers: follower.followers || follower.followersCount || 0,
        fromVerified: follower.verified || false,
        fromAvatar: follower.avatar || follower.profileImageUrl,
        toAuthorId: account.id,
        toUsername: username,
        followedAt: now,
        parsedAt: now,
        source: 'connections_module',
        matchedInDB: !!matchedAccount,
        // Weight calculation based on follower's authority
        followerWeight: matchedAccount 
          ? (matchedAccount.influence || 0.5) * 0.7 + (matchedAccount.smart || 0.5) * 0.3
          : Math.min(Math.log10(Math.max(follower.followers || 1, 1)) / 7, 1) * 0.5,
      };
      
      await followGraphCol.updateOne(
        { fromAuthorId: edge.fromAuthorId, toAuthorId: edge.toAuthorId },
        { $set: edge },
        { upsert: true }
      );
      saved++;
    }
    
    // Update account's topFollowers based on highest weight followers
    const topFollowersEdges = await followGraphCol
      .find({ toAuthorId: account.id })
      .sort({ followerWeight: -1 })
      .limit(10)
      .toArray();
    
    const topFollowers = topFollowersEdges.map(edge => ({
      handle: `@${edge.fromUsername}`,
      name: edge.fromName || '',
      followers: edge.fromFollowers || 0,
      verified: edge.fromVerified || false,
      avatar: edge.fromAvatar,
      weight: edge.followerWeight || 0,
    }));
    
    // Update the account with topFollowers and parse timestamp
    await db.collection(UNIFIED_ACCOUNTS).updateOne(
      { _id: account._id },
      { 
        $set: { 
          topFollowers,
          followersParsedAt: now,
          followerCount: followers.length,
        } 
      }
    );
    
    console.log(`[FollowGraphJob] @${username}: ${saved} followers saved, ${topFollowers.length} top followers updated`);
    
    return { followers, saved };
  } catch (err: any) {
    console.error(`[FollowGraphJob] Error parsing @${username}:`, err.message);
    return { followers: [], saved: 0 };
  }
}

/**
 * Run follow graph parsing for top influencers
 */
export async function refreshFollowGraph(options: {
  limit?: number;        // Number of accounts to process
  minFollowers?: number; // Minimum followers to be eligible
  maxAge?: number;       // Max hours since last parse
} = {}): Promise<{ parsed: number; totalEdges: number }> {
  const { limit = 10, minFollowers = 10000, maxAge = 24 } = options;
  
  if (isRunning) {
    console.log('[FollowGraphJob] Already running, skipping...');
    return { parsed: 0, totalEdges: 0 };
  }
  
  isRunning = true;
  lastError = null;
  
  try {
    const db = getConnectionsDb();
    if (!db) {
      console.warn('[FollowGraphJob] No database connection');
      return { parsed: 0, totalEdges: 0 };
    }
    
    console.log('[FollowGraphJob] Starting auto-parse follow graph...');
    
    // Find top influencers that haven't been parsed recently
    const maxAgeDate = new Date();
    maxAgeDate.setHours(maxAgeDate.getHours() - maxAge);
    
    const accounts = await db.collection(UNIFIED_ACCOUNTS)
      .find({
        kind: 'TWITTER',
        followers: { $gte: minFollowers },
        $or: [
          { followersParsedAt: { $exists: false } },
          { followersParsedAt: { $lt: maxAgeDate } }
        ]
      })
      .sort({ followers: -1 })
      .limit(limit)
      .toArray();
    
    console.log(`[FollowGraphJob] Found ${accounts.length} accounts to parse`);
    
    let totalParsedThisRun = 0;
    
    for (const account of accounts) {
      const result = await parseAccountFollowers(db, account, 50);
      if (result.saved > 0) {
        totalParsedThisRun++;
      }
      
      // Delay between accounts to avoid rate limits
      await new Promise(r => setTimeout(r, 3000));
    }
    
    totalParsed += totalParsedThisRun;
    lastRunAt = new Date();
    
    // Get total edges count
    const totalEdges = await db.collection(FOLLOW_GRAPH).countDocuments();
    
    console.log(`[FollowGraphJob] Completed. Parsed: ${totalParsedThisRun}, Total edges: ${totalEdges}`);
    
    return { parsed: totalParsedThisRun, totalEdges };
  } catch (err: any) {
    lastError = err.message;
    console.error('[FollowGraphJob] Error:', err);
    return { parsed: 0, totalEdges: 0 };
  } finally {
    isRunning = false;
  }
}

/**
 * Get job status
 */
export function getFollowGraphJobStatus() {
  return {
    lastRunAt,
    isRunning,
    lastError,
    totalParsed,
  };
}

/**
 * Start auto-refresh job
 */
export function startFollowGraphJob(intervalMinutes: number = 30): void {
  if (intervalId) return;
  
  console.log(`[FollowGraphJob] Starting auto-parse job (every ${intervalMinutes} min)`);
  
  // Run after a small delay to let system stabilize
  setTimeout(() => {
    refreshFollowGraph({ limit: 5 });
  }, 10000);
  
  // Schedule periodic runs
  intervalId = setInterval(() => {
    refreshFollowGraph({ limit: 5 });
  }, intervalMinutes * 60 * 1000);
}

/**
 * Stop auto-refresh job
 */
export function stopFollowGraphJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[FollowGraphJob] Stopped auto-parse job');
  }
}

// Re-export for backward compatibility
export { runFollowGraphCycle } from './index.js';
