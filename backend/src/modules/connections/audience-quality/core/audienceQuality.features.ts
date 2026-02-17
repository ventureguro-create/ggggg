/**
 * AQE Feature Builder
 * 
 * Transforms raw follower data into normalized features.
 */

import type { AQEFollowerFeatures } from '../contracts/audienceQuality.types.js';

export function buildFollowerFeatures(dto: {
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
}): AQEFollowerFeatures {
  const now = Date.now();
  const created = dto.createdAt ? Date.parse(dto.createdAt) : NaN;
  const ageDays = Number.isFinite(created) 
    ? Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24))) 
    : 0;

  const followers = dto.followersCount ?? 0;
  const following = dto.followingCount ?? 0;
  const ratio = following / Math.max(1, followers);

  return {
    account_age_days: ageDays,
    tweets_total: dto.tweetsTotal ?? 0,
    tweets_last_30d: dto.tweetsLast30d ?? 0,
    followers_count: followers,
    following_count: following,
    follow_ratio: Math.round(ratio * 100) / 100,
    avg_likes: dto.avgLikes ?? 0,
    avg_retweets: dto.avgRetweets ?? 0,
    activity_days_last_30: dto.activityDaysLast30 ?? 0,
    has_avatar: dto.hasAvatar ?? false,
    has_bio: dto.hasBio ?? false,
  };
}
