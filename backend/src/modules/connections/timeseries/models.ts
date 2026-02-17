/**
 * Time Series MongoDB Models
 * 
 * Three collections for historical data:
 * 1. connections_ts_followers - Follower growth history
 * 2. connections_ts_engagement - Engagement metrics history
 * 3. connections_ts_scores - Score evolution history
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// FOLLOWERS TIME SERIES
// ============================================================

export interface ITSFollowers extends Document {
  account_id: string;
  ts: Date;
  followers: number;
  delta_1d?: number;
  delta_7d?: number;
  source: 'mock' | 'twitter';
  created_at: Date;
}

const TSFollowersSchema = new Schema<ITSFollowers>(
  {
    account_id: { type: String, required: true, index: true },
    ts: { type: Date, required: true, index: true },
    followers: { type: Number, required: true },
    delta_1d: { type: Number },
    delta_7d: { type: Number },
    source: { type: String, enum: ['mock', 'twitter'], default: 'mock' },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'connections_ts_followers' }
);

TSFollowersSchema.index({ account_id: 1, ts: -1 });
TSFollowersSchema.index({ account_id: 1, source: 1 });

export const TSFollowersModel = 
  mongoose.models.TSFollowers ||
  mongoose.model<ITSFollowers>('TSFollowers', TSFollowersSchema);

// ============================================================
// ENGAGEMENT TIME SERIES
// ============================================================

export interface ITSEngagement extends Document {
  account_id: string;
  ts: Date;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  views?: number;
  posts_count: number;
  engagement_rate?: number;
  source: 'mock' | 'twitter';
  created_at: Date;
}

const TSEngagementSchema = new Schema<ITSEngagement>(
  {
    account_id: { type: String, required: true, index: true },
    ts: { type: Date, required: true, index: true },
    likes: { type: Number, default: 0 },
    reposts: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    quotes: { type: Number, default: 0 },
    views: { type: Number },
    posts_count: { type: Number, default: 0 },
    engagement_rate: { type: Number },
    source: { type: String, enum: ['mock', 'twitter'], default: 'mock' },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'connections_ts_engagement' }
);

TSEngagementSchema.index({ account_id: 1, ts: -1 });
TSEngagementSchema.index({ account_id: 1, source: 1 });

export const TSEngagementModel = 
  mongoose.models.TSEngagement ||
  mongoose.model<ITSEngagement>('TSEngagement', TSEngagementSchema);

// ============================================================
// SCORES TIME SERIES
// ============================================================

export type GradeType = 'S' | 'A' | 'B' | 'C' | 'D';
export type EarlySignalBadge = 'none' | 'rising' | 'breakout';

export interface ITSScores extends Document {
  account_id: string;
  ts: Date;
  twitter_score: number; // 0-1000
  grade: GradeType;
  components: {
    influence: number;
    quality: number;
    trend: number;
    network: number;
    consistency: number;
  };
  network_sub: {
    audience_quality: number;
    authority_proximity: number;
  };
  early_signal: {
    badge: EarlySignalBadge;
    score: number;
  };
  source: 'mock' | 'twitter';
  created_at: Date;
}

const TSScoresSchema = new Schema<ITSScores>(
  {
    account_id: { type: String, required: true, index: true },
    ts: { type: Date, required: true, index: true },
    twitter_score: { type: Number, required: true },
    grade: { type: String, enum: ['S', 'A', 'B', 'C', 'D'], required: true },
    components: {
      influence: { type: Number, default: 0 },
      quality: { type: Number, default: 0 },
      trend: { type: Number, default: 0 },
      network: { type: Number, default: 0 },
      consistency: { type: Number, default: 0 },
    },
    network_sub: {
      audience_quality: { type: Number, default: 0 },
      authority_proximity: { type: Number, default: 0 },
    },
    early_signal: {
      badge: { type: String, enum: ['none', 'rising', 'breakout'], default: 'none' },
      score: { type: Number, default: 0 },
    },
    source: { type: String, enum: ['mock', 'twitter'], default: 'mock' },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'connections_ts_scores' }
);

TSScoresSchema.index({ account_id: 1, ts: -1 });
TSScoresSchema.index({ account_id: 1, 'early_signal.badge': 1 });
TSScoresSchema.index({ twitter_score: -1 });

export const TSScoresModel = 
  mongoose.models.TSScores ||
  mongoose.model<ITSScores>('TSScores', TSScoresSchema);
