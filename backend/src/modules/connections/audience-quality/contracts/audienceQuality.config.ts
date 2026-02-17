/**
 * AQE Configuration
 * 
 * Thresholds for follower classification.
 * These are tunable per-deployment.
 */

export type AQEConfig = {
  enabled: boolean;
  sampleSize: number;      // how many followers to sample
  cacheTtlSeconds: number;

  // REAL thresholds
  real_min_age_days: number;
  real_min_tweets_total: number;
  real_min_followers: number;
  real_min_active_days_30: number;

  // LOW_QUALITY thresholds
  lowq_min_age_days: number;

  // BOT_LIKELY thresholds
  bot_max_age_days: number;
  bot_max_tweets_total: number;
  bot_min_following: number;
  bot_max_followers: number;

  // FARM_NODE thresholds
  farm_min_following: number;
  farm_max_followers: number;
  farm_min_follow_ratio: number;

  // Anomaly detection
  spike_z_threshold: number;          // growth spike zscore threshold
  engagement_flat_ratio_threshold: number; // below -> flat
};

export const DEFAULT_AQE_CONFIG: AQEConfig = {
  enabled: true,
  sampleSize: 400,
  cacheTtlSeconds: 60 * 60 * 6, // 6h

  // REAL: established, active accounts
  real_min_age_days: 90,
  real_min_tweets_total: 30,
  real_min_followers: 50,
  real_min_active_days_30: 3,

  // LOW_QUALITY: exists but passive
  lowq_min_age_days: 30,

  // BOT_LIKELY: new, empty, mass-following
  bot_max_age_days: 14,
  bot_max_tweets_total: 5,
  bot_min_following: 500,
  bot_max_followers: 20,

  // FARM_NODE: follow farms
  farm_min_following: 2000,
  farm_max_followers: 100,
  farm_min_follow_ratio: 20,

  // Anomaly
  spike_z_threshold: 2.5,
  engagement_flat_ratio_threshold: 0.15,
};
