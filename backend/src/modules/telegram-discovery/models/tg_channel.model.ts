/**
 * TG Channel Model
 * Collection: tg_channels
 * 
 * Хранит информацию о Telegram каналах
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgChannel extends Document {
  channelId: string;           // Telegram channel ID (unique)
  username: string;            // @username
  title: string;               // Channel title
  description?: string;        // Channel description
  
  // Discovery metadata
  discoveredAt: Date;
  discoveredFrom?: string;     // Source channel username
  discoveryMethod: 'seed' | 'forward' | 'mention' | 'manual';
  
  // Metrics
  subscriberCount?: number;
  avgPostViews?: number;
  avgEngagement?: number;
  postsPerDay?: number;
  
  // Status
  status: 'candidate' | 'active' | 'paused' | 'rejected' | 'dead';
  lastChecked?: Date;
  lastPostAt?: Date;
  
  // Scoring
  qualityScore?: number;       // 0-100
  fraudScore?: number;         // 0-100 (higher = more suspicious)
  rankingScore?: number;       // Final ranking
  
  // Tags & Categories
  tags: string[];
  category?: string;
  language?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const TgChannelSchema = new Schema<ITgChannel>({
  channelId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: String,
  
  discoveredAt: { type: Date, default: Date.now },
  discoveredFrom: String,
  discoveryMethod: { 
    type: String, 
    enum: ['seed', 'forward', 'mention', 'manual'],
    default: 'manual'
  },
  
  subscriberCount: Number,
  avgPostViews: Number,
  avgEngagement: Number,
  postsPerDay: Number,
  
  status: {
    type: String,
    enum: ['candidate', 'active', 'paused', 'rejected', 'dead'],
    default: 'candidate',
    index: true
  },
  lastChecked: Date,
  lastPostAt: Date,
  
  qualityScore: { type: Number, min: 0, max: 100 },
  fraudScore: { type: Number, min: 0, max: 100 },
  rankingScore: Number,
  
  tags: { type: [String], default: [] },
  category: String,
  language: String,
}, {
  timestamps: true,
  collection: 'tg_channels'
});

// Indexes
TgChannelSchema.index({ status: 1, rankingScore: -1 });
TgChannelSchema.index({ discoveredAt: -1 });
TgChannelSchema.index({ tags: 1 });

export const TgChannelModel = model<ITgChannel>('TgChannel', TgChannelSchema);
