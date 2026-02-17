/**
 * BLOCK 20 - Real Top Followers Service
 * 
 * Gets real influential followers (not bots/farms)
 */

import type { Db, Collection, Document } from 'mongodb';
import { followerQualityScore, farmPenalty, realFollowerScore, type FarmLevel } from '../formulas/follower-quality.score.js';

export interface RealTopFollower {
  followerId: string;
  handle?: string;
  avatar?: string;
  followers: number;
  qualityScore: number;
  farmLevel: FarmLevel;
  realScore: number;
}

export class RealTopFollowersService {
  private actorFollowers: Collection<Document>;
  private followerProfiles: Collection<Document>;
  private followerFlags: Collection<Document>;

  constructor(private db: Db) {
    this.actorFollowers = db.collection('actor_followers');
    this.followerProfiles = db.collection('followers_profiles');
    this.followerFlags = db.collection('follower_flags');
  }

  /**
   * Get top real followers for an actor
   */
  async get(actorId: string, limit = 10): Promise<RealTopFollower[]> {
    // Get followers with profiles
    const followers = await this.actorFollowers.aggregate([
      { $match: { actorId } },
      {
        $lookup: {
          from: 'followers_profiles',
          localField: 'followerId',
          foreignField: 'followerId',
          as: 'profile'
        }
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'follower_flags',
          localField: 'followerId',
          foreignField: 'followerId',
          as: 'flag'
        }
      },
      { $unwind: { path: '$flag', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'farm_overlap_edges',
          let: { fid: '$followerId' },
          pipeline: [
            { $match: { $expr: { $gt: ['$sharedSuspects', 0] } } },
            { $limit: 10 }
          ],
          as: 'farmEdges'
        }
      },
      { $limit: limit * 5 } // Get more to filter
    ]).toArray();

    // Score and rank
    const scored: RealTopFollower[] = followers.map((f: any) => {
      const profile = f.profile || {};
      const flag = f.flag || {};

      const features = {
        followers: profile.followers || 0,
        following: profile.following || 0,
        accountAgeDays: profile.accountAgeDays || 0,
        tweets30d: profile.tweets30d || 0,
        likes30d: profile.likes30d || 0,
        retweets30d: profile.retweets30d || 0,
        followsPerDay: profile.followsPerDay || 0,
        isVerified: profile.isVerified || false
      };

      const qualityScore = followerQualityScore(features);
      const farmLevel: FarmLevel = flag.farmLevel || 'CLEAN';
      const penalty = farmPenalty({
        farmLevel,
        sharedFarmEdges: (f.farmEdges || []).length
      });
      const score = realFollowerScore(qualityScore, penalty, features.followers);

      return {
        followerId: f.followerId,
        handle: profile.handle,
        avatar: profile.avatar,
        followers: features.followers,
        qualityScore: Math.round(qualityScore * 10) / 10,
        farmLevel,
        realScore: Math.round(score * 10) / 10
      };
    });

    // Filter out farms and sort
    return scored
      .filter(f => f.farmLevel !== 'FARM')
      .sort((a, b) => b.realScore - a.realScore)
      .slice(0, limit);
  }
}
