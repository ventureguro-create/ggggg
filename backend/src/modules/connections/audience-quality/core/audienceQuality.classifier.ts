/**
 * AQE Follower Classifier
 * 
 * Rules-based classification into 4 quality tiers:
 * - REAL: Normal, active accounts
 * - LOW_QUALITY: Passive but legitimate
 * - BOT_LIKELY: High automation probability
 * - FARM_NODE: Follow farm nodes
 * 
 * Priority: FARM_NODE > BOT_LIKELY > LOW_QUALITY > REAL
 */

import type { AQEConfig } from '../contracts/audienceQuality.config.js';
import type { AQEFollowerClassified } from '../contracts/audienceQuality.types.js';
import { buildFollowerFeatures } from './audienceQuality.features.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function classifyFollower(input: {
  followerId: string;
  username?: string;
  profile: Parameters<typeof buildFollowerFeatures>[0];
  cfg: AQEConfig;
}): AQEFollowerClassified {
  const { cfg } = input;
  const features = buildFollowerFeatures(input.profile);
  const reasons: string[] = [];

  // Priority: FARM_NODE > BOT_LIKELY > LOW_QUALITY > REAL

  // 1. FARM_NODE check
  if (
    features.following_count >= cfg.farm_min_following &&
    features.followers_count <= cfg.farm_max_followers &&
    features.follow_ratio >= cfg.farm_min_follow_ratio
  ) {
    reasons.push(`following>=${cfg.farm_min_following}`);
    reasons.push(`followers<=${cfg.farm_max_followers}`);
    reasons.push(`follow_ratio>=${cfg.farm_min_follow_ratio}`);
    return {
      followerId: input.followerId,
      username: input.username,
      label: 'FARM_NODE',
      score: 0.9,
      features,
      reasons,
    };
  }

  // 2. BOT_LIKELY check
  if (
    features.account_age_days <= cfg.bot_max_age_days &&
    features.tweets_total <= cfg.bot_max_tweets_total &&
    features.following_count >= cfg.bot_min_following &&
    features.followers_count <= cfg.bot_max_followers
  ) {
    reasons.push(`age<=${cfg.bot_max_age_days}`);
    reasons.push(`tweets_total<=${cfg.bot_max_tweets_total}`);
    reasons.push(`following>=${cfg.bot_min_following}`);
    reasons.push(`followers<=${cfg.bot_max_followers}`);
    return {
      followerId: input.followerId,
      username: input.username,
      label: 'BOT_LIKELY',
      score: 0.8,
      features,
      reasons,
    };
  }

  // 3. REAL check
  const realOk =
    features.account_age_days >= cfg.real_min_age_days &&
    features.tweets_total >= cfg.real_min_tweets_total &&
    features.followers_count >= cfg.real_min_followers &&
    features.activity_days_last_30 >= cfg.real_min_active_days_30;

  if (realOk) {
    reasons.push(`age>=${cfg.real_min_age_days}`);
    reasons.push(`tweets_total>=${cfg.real_min_tweets_total}`);
    reasons.push(`followers>=${cfg.real_min_followers}`);
    reasons.push(`active_days_30>=${cfg.real_min_active_days_30}`);
    return {
      followerId: input.followerId,
      username: input.username,
      label: 'REAL',
      score: 0.85,
      features,
      reasons,
    };
  }

  // 4. LOW_QUALITY (default)
  if (features.account_age_days >= cfg.lowq_min_age_days) {
    reasons.push(`age>=${cfg.lowq_min_age_days}`);
  }
  if (features.activity_days_last_30 <= 1) {
    reasons.push('low_activity');
  }
  if (features.tweets_total < 20) {
    reasons.push('low_tweets');
  }

  const lowScore = clamp01(0.55 + (features.account_age_days >= cfg.lowq_min_age_days ? 0.15 : 0));
  
  return {
    followerId: input.followerId,
    username: input.username,
    label: 'LOW_QUALITY',
    score: lowScore,
    features,
    reasons: reasons.length ? reasons : ['default_low_quality'],
  };
}
