/**
 * Audience Quality Engine (AQE) - Types
 * 
 * Rules-based audience quality assessment.
 * NOT ML, NOT accusations - just quality metrics.
 */

export type AQELabel = 'REAL' | 'LOW_QUALITY' | 'BOT_LIKELY' | 'FARM_NODE';

export type AQEConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type AQEFollowerFeatures = {
  account_age_days: number;
  tweets_total: number;
  tweets_last_30d: number;
  followers_count: number;
  following_count: number;
  follow_ratio: number;          // following / max(1, followers)
  avg_likes: number;
  avg_retweets: number;
  activity_days_last_30: number; // distinct active days
  has_avatar: boolean;
  has_bio: boolean;
};

export type AQEFollowerClassified = {
  followerId: string;
  username?: string;
  label: AQELabel;
  score: number; // 0..1 confidence for label
  features: AQEFollowerFeatures;
  reasons: string[];
};

export type AQEBreakdown = {
  real: number;
  low_quality: number;
  bot_likely: number;
  farm_node: number;
};

export type AQEAnomaly = {
  growth_spike: boolean;
  engagement_flat: boolean;
  anomaly: boolean;
  notes: string[];
};

export type AQEResult = {
  actorId: string;          // Connections actor id
  twitterHandle?: string;   // if available
  sampledFollowers: number;
  totalFollowersHint?: number;

  real_audience_pct: number;   // 0..1
  bot_pressure_pct: number;    // 0..1
  confidence: number;          // 0..1
  confidence_level: AQEConfidenceLevel;

  breakdown: AQEBreakdown;
  anomaly: AQEAnomaly;

  topSuspiciousFollowers: Array<Pick<AQEFollowerClassified, 'followerId'|'username'|'label'|'reasons'>>;
  createdAt: string;
  ttlSeconds: number;
};
