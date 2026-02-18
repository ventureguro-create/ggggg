/**
 * TG Metrics Model (EXTENDED)
 * Collection: tg_metrics
 * 
 * Расширенная модель с advanced детекторами
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgMetrics extends Document {
  channelId: string;
  username: string;
  timestamp: Date;
  
  // === Base metrics ===
  subscriberCount: number;
  subscriberDelta: number;
  postsCount: number;
  totalViews: number;
  avgViews: number;
  medianViews: number;
  maxViews: number;
  postsPerDay: number;
  
  // === Engagement ===
  forwardRate: number;
  replyRate: number;
  engagementRate: number;
  growthRate: number;
  
  // === View distribution ===
  viewDispersion: number;
  spikeRatio: number;
  
  // === Promo detection ===
  promoDensity: number;
  linkBlockRatio: number;
  promoScore: number;
  
  // === Burst detection ===
  burstScore: number;
  peakClusterRatio: number;
  maxClusterLen: number;
  
  // === Elasticity ===
  elasticityScore: number;
  elasticLowQ: number;
  elasticMidQ: number;
  elasticHighQ: number;
  
  // === Originality ===
  duplicateRatio: number;
  originalityScore: number;
  
  // === Forward composition ===
  forwardedPostRatio: number;
  forwardedViewsRatio: number;
  repostinessScore: number;
  
  // === Language ===
  language: string;
  langRuScore: number;
  langUaScore: number;
  langEnScore: number;
  
  // === Topics ===
  topicVector: Record<string, number>;
  topTopics: string[];
  
  // === Source diversity ===
  forwardedTotal: number;
  uniqueForwardSources: number;
  dominantForwardSource: string | null;
  dominantSourceRatio: number;
  sourceHHI: number;
  diversityScore: number;
  topForwardSources: string[];
  
  // === Cross-reuse ===
  reuseRatio: number;
  reuseClusterCount: number;
  maxReuseClusterSize: number;
  reuseScore: number;
  
  computedAt: Date;
  createdAt: Date;
}

const TgMetricsSchema = new Schema<ITgMetrics>({
  channelId: { type: String, index: true },
  username: { type: String, required: true, index: true },
  timestamp: { type: Date, index: true },
  
  // Base
  subscriberCount: { type: Number, default: 0 },
  subscriberDelta: { type: Number, default: 0 },
  postsCount: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },
  avgViews: { type: Number, default: 0 },
  medianViews: { type: Number, default: 0 },
  maxViews: { type: Number, default: 0 },
  postsPerDay: { type: Number, default: 0 },
  
  // Engagement
  forwardRate: { type: Number, default: 0 },
  replyRate: { type: Number, default: 0 },
  engagementRate: { type: Number, default: 0 },
  growthRate: { type: Number, default: 0 },
  
  // View distribution
  viewDispersion: { type: Number, default: 0 },
  spikeRatio: { type: Number, default: 0 },
  
  // Promo
  promoDensity: { type: Number, default: 0 },
  linkBlockRatio: { type: Number, default: 0 },
  promoScore: { type: Number, default: 0 },
  
  // Burst
  burstScore: { type: Number, default: 0 },
  peakClusterRatio: { type: Number, default: 0 },
  maxClusterLen: { type: Number, default: 0 },
  
  // Elasticity
  elasticityScore: { type: Number, default: 0 },
  elasticLowQ: { type: Number, default: 0 },
  elasticMidQ: { type: Number, default: 0 },
  elasticHighQ: { type: Number, default: 0 },
  
  // Originality
  duplicateRatio: { type: Number, default: 0 },
  originalityScore: { type: Number, default: 1 },
  
  // Forward composition
  forwardedPostRatio: { type: Number, default: 0 },
  forwardedViewsRatio: { type: Number, default: 0 },
  repostinessScore: { type: Number, default: 0 },
  
  // Language
  language: { type: String, default: 'UNKNOWN' },
  langRuScore: { type: Number, default: 0 },
  langUaScore: { type: Number, default: 0 },
  langEnScore: { type: Number, default: 0 },
  
  // Topics
  topicVector: { type: Schema.Types.Mixed, default: {} },
  topTopics: { type: [String], default: [] },
  
  // Source diversity
  forwardedTotal: { type: Number, default: 0 },
  uniqueForwardSources: { type: Number, default: 0 },
  dominantForwardSource: { type: String, default: null },
  dominantSourceRatio: { type: Number, default: 0 },
  sourceHHI: { type: Number, default: 0 },
  diversityScore: { type: Number, default: 1 },
  topForwardSources: { type: [String], default: [] },
  
  // Cross-reuse
  reuseRatio: { type: Number, default: 0 },
  reuseClusterCount: { type: Number, default: 0 },
  maxReuseClusterSize: { type: Number, default: 0 },
  reuseScore: { type: Number, default: 0 },
  
  computedAt: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'tg_metrics'
});

TgMetricsSchema.index({ username: 1, timestamp: 1 }, { unique: true });
TgMetricsSchema.index({ timestamp: -1 });

export const TgMetricsModel = model<ITgMetrics>('TgMetrics', TgMetricsSchema);
