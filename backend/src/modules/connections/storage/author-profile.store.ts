/**
 * Author Profile Storage
 * 
 * MongoDB-backed storage for author profiles.
 * Replaces in-memory Map storage.
 */

import { ConnectionsAuthorProfileModel, IConnectionsAuthorProfile } from './author-profile.model.js';
import type { AuthorProfile } from '../core/scoring/compute-influence-score.js';

/**
 * Upsert author profile (create or update)
 */
export async function upsertAuthorProfile(authorId: string, patch: Partial<IConnectionsAuthorProfile>): Promise<void> {
  // Remove author_id from patch to avoid conflict
  const { author_id, ...updateData } = patch as any;
  
  await ConnectionsAuthorProfileModel.updateOne(
    { author_id: authorId },
    { 
      $set: { 
        ...updateData,
        updatedAt: new Date(),
      },
      $setOnInsert: { 
        author_id: authorId,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Merge engaged user IDs for overlap calculations
 * Uses $addToSet to avoid duplicates
 */
export async function mergeAudience(
  authorId: string, 
  handle: string, 
  engagedIds: string[], 
  windowDays = 30
): Promise<void> {
  if (!engagedIds || engagedIds.length === 0) return;
  
  await ConnectionsAuthorProfileModel.updateOne(
    { author_id: authorId },
    {
      $set: { 
        handle, 
        'audience.window_days': windowDays,
        updatedAt: new Date(),
      },
      $addToSet: { 
        'audience.engaged_user_ids': { $each: engagedIds } 
      },
      $setOnInsert: {
        author_id: authorId,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Save author profile (for backwards compatibility)
 */
export async function saveAuthorProfile(profile: AuthorProfile): Promise<void> {
  await upsertAuthorProfile(profile.author_id, {
    handle: profile.handle,
    activity: {
      posts_count: profile.activity.posts_count,
      posts_per_day: profile.activity.posts_per_day,
      total_engagement: profile.activity.total_engagement,
      avg_engagement_quality: profile.activity.avg_engagement_quality,
      engagement_stability: profile.activity.engagement_stability,
      volatility: profile.activity.volatility,
    },
    scores: {
      influence_score: profile.scores.influence_score,
      risk_level: profile.scores.risk_level,
      red_flags: profile.scores.red_flags,
      red_flag_reasons: profile.scores.red_flag_reasons || [],
    },
    _engagement_history: profile._engagement_history || [],
  } as any);
}

/**
 * Get single author profile by ID
 * First checks ConnectionsAuthorProfile, then falls back to unified accounts
 */
export async function getAuthorProfile(authorId: string): Promise<IConnectionsAuthorProfile | null> {
  // First try the main profiles collection
  const profile = await ConnectionsAuthorProfileModel.findOne({ author_id: authorId }).lean();
  if (profile) return profile;
  
  // Fallback to unified accounts (Twitter imports)
  const { getMongoDb } = await import('../../../db/mongoose.js');
  const db = getMongoDb();
  const unified = await db.collection('connections_unified_accounts').findOne({
    $or: [
      { id: authorId },
      { handle: authorId.startsWith('@') ? authorId : `@${authorId}` },
      { handle: authorId }
    ]
  });
  
  if (!unified) return null;
  
  // Transform unified account to AuthorProfile format
  return {
    author_id: unified.id,
    handle: unified.handle?.replace('@', ''),
    username: unified.title,
    avatar: unified.avatar,
    followers: unified.followers,
    profile: unified.followers >= 500000 ? 'whale' : unified.followers >= 50000 ? 'influencer' : 'retail',
    activity: {
      posts_count: unified.tweetCount || 0,
      posts_per_day: 0,
      total_engagement: unified.totalEngagement || 0,
      avg_engagement_quality: unified.engagement || 0,
      engagement_stability: 0.7,
      volatility: 0.2,
      window_days: 30,
    },
    scores: {
      influence_score: Math.round((unified.influence || 0.5) * 1000),
      x_score: unified.twitterScore || Math.round((unified.engagement || 0.5) * 600),
      signal_noise: unified.engagement ? (unified.engagement * 10) : 5,
      risk_level: unified.confidence > 0.7 ? 'low' : unified.confidence > 0.4 ? 'medium' : 'high',
    },
    audience: {
      engaged_user_ids: [],
      window_days: 30,
    },
    trend: {
      velocity_norm: unified.engagement ? (unified.engagement - 0.5) * 2 : 0,
      acceleration_norm: 0.1,
    },
    risk_flags: [],
    categories: unified.categories || [],
    source: unified.source,
    createdAt: unified.importedAt || new Date(),
    updatedAt: unified.lastSeen || new Date(),
  } as any;
}

/**
 * Get single author profile by handle
 */
export async function getAuthorProfileByHandle(handle: string): Promise<IConnectionsAuthorProfile | null> {
  return ConnectionsAuthorProfileModel.findOne({ handle }).lean();
}

/**
 * List author profiles with sorting and pagination
 */
export async function listAuthorProfiles(options?: {
  sortBy?: 'influence_score' | 'posts_count' | 'updated_at';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<{ items: IConnectionsAuthorProfile[]; total: number }> {
  const sortBy = options?.sortBy ?? 'influence_score';
  const order = options?.order === 'asc' ? 1 : -1;
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  
  // Build sort object
  let sortField: string;
  switch (sortBy) {
    case 'influence_score':
      sortField = 'scores.influence_score';
      break;
    case 'posts_count':
      sortField = 'activity.posts_count';
      break;
    case 'updated_at':
      sortField = 'updatedAt';
      break;
    default:
      sortField = 'scores.influence_score';
  }
  
  const [items, total] = await Promise.all([
    ConnectionsAuthorProfileModel
      .find({})
      .sort({ [sortField]: order })
      .skip(offset)
      .limit(limit)
      .lean(),
    ConnectionsAuthorProfileModel.countDocuments({}),
  ]);
  
  return { items, total };
}

/**
 * Delete author profile
 */
export async function deleteAuthorProfile(authorId: string): Promise<boolean> {
  const result = await ConnectionsAuthorProfileModel.deleteOne({ author_id: authorId });
  return result.deletedCount > 0;
}

/**
 * Clear all profiles (use with caution)
 */
export async function clearAllProfiles(): Promise<void> {
  await ConnectionsAuthorProfileModel.deleteMany({});
}

/**
 * Get store statistics
 */
export async function getStoreStats(): Promise<{ count: number }> {
  const count = await ConnectionsAuthorProfileModel.countDocuments({});
  return { count };
}
