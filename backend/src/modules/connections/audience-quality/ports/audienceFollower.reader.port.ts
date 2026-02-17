/**
 * Audience Follower Reader Port
 * 
 * Abstraction layer for follower data source.
 * Can be implemented by: Twitter Parser, MongoDB, Mock.
 */

export type FollowerProfileDTO = {
  id: string;
  username?: string;

  createdAt?: string; // ISO
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

export type FollowerSampleDTO = {
  actorId: string;            // Connections actor
  twitterHandle?: string;

  totalFollowersHint?: number;
  followers: FollowerProfileDTO[];

  // optional time series (if available)
  followersSeries?: Array<{ ts: string; followers: number }>;
  engagementSeries?: Array<{ ts: string; engagement: number }>;
};

export interface IAudienceFollowerReader {
  sampleFollowers(input: { actorId: string; sampleSize: number }): Promise<FollowerSampleDTO | null>;
}
