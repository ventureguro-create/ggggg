/**
 * Metrics Window Model
 * Collection: tg_metrics_windows
 */
import mongoose, { Schema } from 'mongoose';

const TgMetricsWindowSchema = new Schema(
  {
    username: { type: String, index: true },
    window: { type: String, enum: ['7d', '30d', '90d'], index: true },

    postsCount: Number,
    postsPerDay: Number,
    activeDaysRatio: Number,

    medianViews: Number,
    p90Views: Number,
    viewDispersion: Number,
    viewGrowthSlope: Number,

    forwardRate: Number,
    replyRate: Number,

    burstScore: Number,
    promoDensity: Number,
    originalityScore: Number,
    diversityScore: Number,
    reuseScore: Number,

    computedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

TgMetricsWindowSchema.index({ username: 1, window: 1 }, { unique: true });

export const TgMetricsWindowModel =
  mongoose.models.TgMetricsWindow ||
  mongoose.model('TgMetricsWindow', TgMetricsWindowSchema);
