/**
 * TG Metrics Model
 * Collection: tg_metrics
 * 
 * Временные ряды метрик каналов (hourly snapshots)
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgMetrics extends Document {
  channelId: string;
  timestamp: Date;             // Hourly bucket
  
  // Growth metrics
  subscriberCount: number;
  subscriberDelta: number;     // Change since last snapshot
  
  // Engagement metrics
  postsCount: number;          // Posts in this hour
  totalViews: number;
  avgViews: number;
  maxViews: number;
  
  // Activity
  forwardsReceived: number;    // Forwards from other channels
  mentionsReceived: number;    // Mentions from other channels
  
  // Calculated
  engagementRate: number;      // views / subscribers
  growthRate: number;          // subscriber delta / subscribers
  
  createdAt: Date;
}

const TgMetricsSchema = new Schema<ITgMetrics>({
  channelId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  
  subscriberCount: { type: Number, default: 0 },
  subscriberDelta: { type: Number, default: 0 },
  
  postsCount: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },
  avgViews: { type: Number, default: 0 },
  maxViews: { type: Number, default: 0 },
  
  forwardsReceived: { type: Number, default: 0 },
  mentionsReceived: { type: Number, default: 0 },
  
  engagementRate: { type: Number, default: 0 },
  growthRate: { type: Number, default: 0 },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'tg_metrics'
});

// Compound unique index for hourly buckets
TgMetricsSchema.index({ channelId: 1, timestamp: 1 }, { unique: true });
TgMetricsSchema.index({ timestamp: -1 });

export const TgMetricsModel = model<ITgMetrics>('TgMetrics', TgMetricsSchema);
