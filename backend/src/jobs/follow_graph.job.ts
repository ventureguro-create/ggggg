/**
 * Follow Graph Auto-Parse Job
 * Periodically parses followers for top influencers to build the follow graph
 * Updates Top Followers data for each account
 */
import { getMongoDb } from '../db/mongoose.js';
import { twitterExecutionAdapter } from '../modules/twitter/execution/execution.adapter.js';

const COLLECTION = 'connections_unified_accounts';
const FOLLOW_GRAPH_COLLECTION = 'connections_follow_graph';

let lastRunAt: Date | null = null;
let isRunning = false;
let lastError: string | null = null;
let totalParsed = 0;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Parse followers for a single account
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
    
    // Use execution adapter to fetch followers
    const result = await twitterExecutionAdapter.getFollowers(username, limit);
    
    if (!result.ok || !result.data?.followers?.length) {
      console.log(`[FollowGraphJob] No followers data for @${username}: ${result.error || 'empty'}`);
      return { followers: [], saved: 0 };
    }
    
    const followers = result.data.followers;
    const now = new Date();
    
    // Get existing unified accounts to match followers
    const allAccounts = await db.collection(COLLECTION).find({}).toArray();
    const accountByHandle = new Map<string, any>();
    for (const acc of allAccounts) {
      const handle = acc.handle?.replace('@', '').toLowerCase();
      if (handle) accountByHandle.set(handle, acc);
    }
    
    // Save follow edges to follow graph collection
    const followGraphCol = db.collection(FOLLOW_GRAPH_COLLECTION);
    let saved = 0;
    
    for (const follower of followers) {
      const followerHandle = follower.username?.toLowerCase();
      const matchedAccount = accountByHandle.get(followerHandle);
      
      // Create follow edge
      const edge = {
        fromAuthorId: matchedAccount?.id || `tw:${follower.id}`,
        fromUsername: follower.username,
        fromName: follower.name,
        fromFollowers: follower.followers || 0,
        fromVerified: follower.verified || false,
        fromAvatar: follower.avatar,
        toAuthorId: account.id,
        toUsername: username,
        followedAt: now,
        parsedAt: now,
        source: 'auto_parser',
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
    await db.collection(COLLECTION).updateOne(
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
    const db = getMongoDb();
    console.log('[FollowGraphJob] Starting auto-parse follow graph...');
    
    // Find top influencers that haven't been parsed recently
    const maxAgeDate = new Date();
    maxAgeDate.setHours(maxAgeDate.getHours() - maxAge);
    
    const accounts = await db.collection(COLLECTION)
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
    const totalEdges = await db.collection(FOLLOW_GRAPH_COLLECTION).countDocuments();
    
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
export function startFollowGraphJob(intervalMinutes: number = 30) {
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
export function stopFollowGraphJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[FollowGraphJob] Stopped auto-parse job');
  }
}
