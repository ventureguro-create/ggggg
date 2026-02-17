import { Db } from 'mongodb';
import { FACETS, FacetKey } from './unified.facets.js';
import { buildUnifiedQuery } from './unified.query.builder.js';
import { UnifiedAccount } from './unified.contracts.js';

export const COLLECTION = 'connections_unified_accounts';

export async function getUnifiedAccounts(db: Db, facetKey: string, limit: number = 100): Promise<UnifiedAccount[]> {
  const facet = FACETS[facetKey as FacetKey];
  if (!facet) throw new Error(`Unknown facet: ${facetKey}`);

  const pipeline = buildUnifiedQuery(facet, limit);
  const results = await db.collection(COLLECTION).aggregate(pipeline).toArray();
  
  return results.map(doc => ({
    id: doc.id || String(doc._id),
    kind: doc.kind || 'TWITTER',
    title: doc.title || doc.name || doc.username || 'Unknown',
    handle: doc.handle || doc.username,
    avatar: doc.avatar,
    categories: doc.categories || [],
    tags: doc.tags || [],
    smart: doc.smart,
    influence: doc.influence,
    early: doc.early,
    authority: doc.authority,
    handshake: doc.handshake,
    networkSize: doc.networkSize,
    followers: doc.followers,
    following: doc.following || 0,
    engagement: doc.engagement,
    confidence: doc.confidence ?? 0.7,
    searchScore: doc.searchScore,
    verified: doc.verified || false,
    // New metrics
    twitterScore: doc.twitterScore,
    networkScore: doc.networkScore,
    engagementRate: doc.engagementRate,
    avgLikes: doc.avgLikes,
    avgEngagementPerTweet: doc.avgEngagementPerTweet,
    tweetCount: doc.tweetCount,
    totalLikes: doc.totalLikes,
    totalReposts: doc.totalReposts,
    totalReplies: doc.totalReplies,
    totalViews: doc.totalViews,
    lastActive: doc.lastActive,
    source: doc.source,
    // Token mentions
    recentTokens: doc.recentTokens || [],
    tokenMentionCounts: doc.tokenMentionCounts || {},
    recentTweetsText: doc.recentTweetsText || [],
    // Top followers (from embedded data or empty)
    topFollowers: doc.topFollowers || []
  }));
}

/**
 * Initialize indexes only - NO MOCK DATA
 * Real data comes from Twitter Parser via importFromSearchResult()
 */
export async function seedUnifiedAccounts(db: Db): Promise<number> {
  const collection = db.collection(COLLECTION);
  
  // Create indexes for real data
  await collection.createIndex({ kind: 1 }).catch(() => {});
  await collection.createIndex({ smart: -1 }).catch(() => {});
  await collection.createIndex({ influence: -1 }).catch(() => {});
  await collection.createIndex({ early: -1 }).catch(() => {});
  await collection.createIndex({ authority: -1 }).catch(() => {});
  await collection.createIndex({ followers: -1 }).catch(() => {});
  await collection.createIndex({ categories: 1 }).catch(() => {});
  await collection.createIndex({ tags: 1 }).catch(() => {});
  await collection.createIndex({ handle: 1 }, { unique: true, sparse: true }).catch(() => {});
  await collection.createIndex({ source: 1 }).catch(() => {});
  
  const count = await collection.countDocuments();
  console.log(`[Unified] Indexes created. Existing accounts: ${count}`);
  return count;
}
