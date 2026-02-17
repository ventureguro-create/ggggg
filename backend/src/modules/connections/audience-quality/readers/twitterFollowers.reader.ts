/**
 * Twitter Followers Reader (Mock + MongoDB fallback)
 * 
 * Reads from twitter_followers_profiles collection if exists,
 * otherwise generates mock data for UI development.
 */

import type { Db } from 'mongodb';
import type { IAudienceFollowerReader, FollowerSampleDTO, FollowerProfileDTO } from '../ports/audienceFollower.reader.port.js';

type TwitterFollowerProfileDoc = {
  actorId: string;
  followerId: string;
  username?: string;
  createdAt?: string;
  tweetsTotal?: number;
  tweetsLast30d?: number;
  followersCount?: number;
  followingCount?: number;
  avgLikes?: number;
  avgRetweets?: number;
  activityDaysLast30?: number;
  hasAvatar?: boolean;
  hasBio?: boolean;
};

export class TwitterFollowersReader implements IAudienceFollowerReader {
  constructor(private readonly db: Db) {}

  async sampleFollowers(input: { actorId: string; sampleSize: number }): Promise<FollowerSampleDTO | null> {
    // 1. Try real collection
    const colName = 'twitter_followers_profiles';
    const collections = await this.db.listCollections({ name: colName }).toArray();
    
    if (collections.length > 0) {
      const col = this.db.collection<TwitterFollowerProfileDoc>(colName);
      const docs = await col
        .find({ actorId: input.actorId })
        .limit(input.sampleSize)
        .toArray();

      if (docs.length > 0) {
        const followers: FollowerProfileDTO[] = docs.map(d => ({
          id: d.followerId,
          username: d.username,
          createdAt: d.createdAt,
          tweetsTotal: d.tweetsTotal,
          tweetsLast30d: d.tweetsLast30d,
          followersCount: d.followersCount,
          followingCount: d.followingCount,
          avgLikes: d.avgLikes,
          avgRetweets: d.avgRetweets,
          activityDaysLast30: d.activityDaysLast30,
          hasAvatar: d.hasAvatar,
          hasBio: d.hasBio,
        }));

        return {
          actorId: input.actorId,
          followers,
          totalFollowersHint: followers.length,
        };
      }
    }

    // 2. Fallback to mock data
    const followers = seedFollowersMock(input.sampleSize);
    return {
      actorId: input.actorId,
      followers,
      totalFollowersHint: 10_000,
    };
  }
}

/**
 * Generate mock follower data for development/demo.
 * Distribution: ~50% REAL, ~20% LOW_QUALITY, ~20% BOT_LIKELY, ~10% FARM_NODE
 */
function seedFollowersMock(n: number): FollowerProfileDTO[] {
  const now = Date.now();
  const mkDate = (daysAgo: number) => new Date(now - daysAgo * 86400_000).toISOString();

  const out: FollowerProfileDTO[] = [];
  
  for (let i = 0; i < n; i++) {
    const r = i % 10;

    if (r <= 4) {
      // REAL-ish (50%)
      out.push({
        id: `real_${i}`,
        username: `user_real_${i}`,
        createdAt: mkDate(200 + (i % 500)),
        tweetsTotal: 200 + (i % 400),
        tweetsLast30d: 10 + (i % 40),
        followersCount: 150 + (i % 2000),
        followingCount: 100 + (i % 400),
        avgLikes: 3 + (i % 30),
        avgRetweets: 1 + (i % 10),
        activityDaysLast30: 4 + (i % 20),
        hasAvatar: true,
        hasBio: true,
      });
    } else if (r <= 6) {
      // LOW_QUALITY (20%)
      out.push({
        id: `lowq_${i}`,
        username: `user_passive_${i}`,
        createdAt: mkDate(40 + (i % 120)),
        tweetsTotal: 5 + (i % 20),
        tweetsLast30d: (i % 3),
        followersCount: 10 + (i % 50),
        followingCount: 40 + (i % 150),
        avgLikes: 0,
        avgRetweets: 0,
        activityDaysLast30: (i % 2),
        hasAvatar: i % 2 === 0,
        hasBio: i % 3 === 0,
      });
    } else if (r <= 8) {
      // BOT_LIKELY (20%)
      out.push({
        id: `bot_${i}`,
        username: `user${i}${i}${i}`,
        createdAt: mkDate(3 + (i % 10)),
        tweetsTotal: (i % 5),
        tweetsLast30d: (i % 2),
        followersCount: (i % 15),
        followingCount: 700 + (i % 2000),
        avgLikes: 0,
        avgRetweets: 0,
        activityDaysLast30: 0,
        hasAvatar: false,
        hasBio: false,
      });
    } else {
      // FARM_NODE (10%)
      out.push({
        id: `farm_${i}`,
        username: `follow_${i}_bot`,
        createdAt: mkDate(10 + (i % 60)),
        tweetsTotal: 1 + (i % 10),
        tweetsLast30d: 0,
        followersCount: 5 + (i % 80),
        followingCount: 2500 + (i % 4000),
        avgLikes: 0,
        avgRetweets: 0,
        activityDaysLast30: 0,
        hasAvatar: false,
        hasBio: false,
      });
    }
  }
  
  return out;
}
