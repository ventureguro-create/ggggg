/**
 * TG Rankings Model
 * Collection: tg_rankings
 * 
 * Итоговые рейтинги каналов (daily snapshots)
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgRanking extends Document {
  channelId: string;
  date: Date;                  // Daily bucket (YYYY-MM-DD)
  
  // Position
  rank: number;                // Overall rank
  previousRank?: number;       // Previous day rank
  rankChange: number;          // Positive = moved up
  
  // Scores (0-100)
  overallScore: number;
  
  // Component scores
  qualityScore: number;        // Content quality
  engagementScore: number;     // Engagement metrics
  growthScore: number;         // Subscriber growth
  consistencyScore: number;    // Posting consistency
  fraudScore: number;          // Fraud/bot detection (lower is better)
  
  // Weights used
  weights: {
    quality: number;
    engagement: number;
    growth: number;
    consistency: number;
    fraud: number;
  };
  
  // Metadata
  channelSnapshot: {
    username: string;
    title: string;
    subscriberCount: number;
    category?: string;
  };
  
  createdAt: Date;
}

const TgRankingSchema = new Schema<ITgRanking>({
  channelId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  
  rank: { type: Number, required: true },
  previousRank: Number,
  rankChange: { type: Number, default: 0 },
  
  overallScore: { type: Number, required: true },
  
  qualityScore: { type: Number, default: 0 },
  engagementScore: { type: Number, default: 0 },
  growthScore: { type: Number, default: 0 },
  consistencyScore: { type: Number, default: 0 },
  fraudScore: { type: Number, default: 0 },
  
  weights: {
    quality: { type: Number, default: 0.25 },
    engagement: { type: Number, default: 0.25 },
    growth: { type: Number, default: 0.2 },
    consistency: { type: Number, default: 0.15 },
    fraud: { type: Number, default: 0.15 },
  },
  
  channelSnapshot: {
    username: String,
    title: String,
    subscriberCount: Number,
    category: String,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'tg_rankings'
});

// Compound unique index
TgRankingSchema.index({ channelId: 1, date: 1 }, { unique: true });
TgRankingSchema.index({ date: 1, rank: 1 });
TgRankingSchema.index({ date: 1, overallScore: -1 });

export const TgRankingModel = model<ITgRanking>('TgRanking', TgRankingSchema);
