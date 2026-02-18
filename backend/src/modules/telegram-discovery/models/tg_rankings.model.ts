/**
 * TG Ranking Model (EXTENDED)
 * Collection: tg_rankings
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgRanking extends Document {
  channelId: string;
  username: string;
  date: Date;
  
  // Position
  rank: number;
  previousRank?: number;
  rankChange: number;
  
  // Scores
  overallScore: number;
  fraudRisk: number;
  trustLevel: 'A' | 'B' | 'C' | 'D';
  
  // Component scores
  reachScore: number;
  activityScore: number;
  engagementScore: number;
  consistencyScore: number;
  qualityScore: number;
  
  // Channel snapshot
  channelSnapshot: {
    username: string;
    title: string;
    subscriberCount?: number;
    category?: string;
  };
  
  computedAt: Date;
  createdAt: Date;
}

const TgRankingSchema = new Schema<ITgRanking>({
  channelId: { type: String, index: true },
  username: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  
  rank: { type: Number, required: true },
  previousRank: Number,
  rankChange: { type: Number, default: 0 },
  
  overallScore: { type: Number, required: true },
  fraudRisk: { type: Number, default: 0 },
  trustLevel: { 
    type: String, 
    enum: ['A', 'B', 'C', 'D'], 
    default: 'B' 
  },
  
  reachScore: { type: Number, default: 0 },
  activityScore: { type: Number, default: 0 },
  engagementScore: { type: Number, default: 0 },
  consistencyScore: { type: Number, default: 0 },
  qualityScore: { type: Number, default: 0 },
  
  channelSnapshot: {
    username: String,
    title: String,
    subscriberCount: Number,
    category: String,
  },
  
  computedAt: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'tg_rankings'
});

TgRankingSchema.index({ username: 1, date: 1 }, { unique: true });
TgRankingSchema.index({ date: 1, rank: 1 });
TgRankingSchema.index({ date: 1, overallScore: -1 });

export const TgRankingModel = model<ITgRanking>('TgRanking', TgRankingSchema);
