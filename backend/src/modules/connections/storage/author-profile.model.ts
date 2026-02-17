/**
 * Connections Author Profile MongoDB Model
 * 
 * Stores aggregated author metrics and audience data.
 * Used for influence scoring and overlap calculations.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IConnectionsAuthorProfile extends Document {
  author_id: string;
  handle: string;
  
  followers: number;
  follower_growth_30d: number;
  
  activity: {
    posts_count: number;
    posts_per_day: number;
    total_engagement: number;
    avg_engagement_quality: number;
    engagement_stability: 'low' | 'medium' | 'high' | 'unknown';
    volatility: 'low' | 'moderate' | 'high' | 'unknown';
  };
  
  engagement: {
    real_views_estimate: number;
    engagement_quality: number;
  };
  
  network: {
    network_purity_score: number;
    audience_overlap_score: number;
    artificial_engagement_score: number;
  };
  
  scores: {
    influence_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'unknown';
    red_flags: number;
    red_flag_reasons: string[];
  };
  
  // Internal tracking for volatility calculation
  _engagement_history: number[];
  
  // Audience data for overlap calculations
  audience: {
    window_days: number;
    engaged_user_ids: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionsAuthorProfileSchema = new Schema<IConnectionsAuthorProfile>(
  {
    author_id: { type: String, required: true, index: true, unique: true },
    handle: { type: String, required: true, index: true },
    
    followers: { type: Number, default: 0 },
    follower_growth_30d: { type: Number, default: 0 },
    
    activity: {
      posts_count: { type: Number, default: 0 },
      posts_per_day: { type: Number, default: 0 },
      total_engagement: { type: Number, default: 0 },
      avg_engagement_quality: { type: Number, default: 0 },
      engagement_stability: { type: String, default: 'unknown' },
      volatility: { type: String, default: 'unknown' },
    },
    
    engagement: {
      real_views_estimate: { type: Number, default: 0 },
      engagement_quality: { type: Number, default: 0 },
    },
    
    network: {
      network_purity_score: { type: Number, default: 0 },
      audience_overlap_score: { type: Number, default: 0 },
      artificial_engagement_score: { type: Number, default: 0 },
    },
    
    scores: {
      influence_score: { type: Number, default: 0 },
      risk_level: { type: String, default: 'unknown' },
      red_flags: { type: Number, default: 0 },
      red_flag_reasons: { type: [String], default: [] },
    },
    
    // Internal tracking for volatility calculation
    _engagement_history: { type: [Number], default: [] },
    
    // Audience for overlap: unique engaged users in window
    audience: {
      window_days: { type: Number, default: 30 },
      engaged_user_ids: { type: [String], default: [] },
    },
  },
  { 
    timestamps: true, 
    collection: 'connections_author_profiles' 
  }
);

// Indexes for common queries
ConnectionsAuthorProfileSchema.index({ 'scores.influence_score': -1 });
ConnectionsAuthorProfileSchema.index({ 'scores.risk_level': 1 });
ConnectionsAuthorProfileSchema.index({ updatedAt: -1 });

export const ConnectionsAuthorProfileModel = 
  mongoose.models.ConnectionsAuthorProfile ||
  mongoose.model<IConnectionsAuthorProfile>('ConnectionsAuthorProfile', ConnectionsAuthorProfileSchema);
