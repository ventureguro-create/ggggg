/**
 * tg.credibility.model.ts
 * Credibility Score - reliability, recency, stability
 * Phase 3 Step 4
 */
import mongoose, { Schema } from 'mongoose';

const TgCredibilitySchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },

    credibilityScore: { type: Number, default: 0, index: true }, // 0..100
    tier: { type: String, index: true }, // AAA/AA/A/BBB/BB/B/C/D

    // Beta posterior for hit rate
    hitRatePosterior: {
      a: Number,
      b: Number,
      mean: Number,
      ciLow: Number,
      ciHigh: Number,
    },

    // Recency weighting
    recency: {
      halfLifeDays: Number,
      weightedSample: Number,
      recencyAdjustedAlpha: Number,
    },

    // Stability / risk
    stability: {
      std7d: Number,
      drawdown: Number,
      consistency: Number,
      spamPenalty: Number,
    },

    // Trend
    trend: {
      direction: { type: String, enum: ['improving', 'flat', 'deteriorating'] },
      alpha90: Number,
      alpha30: Number,
    },

    computedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'tg_credibility' }
);

export const TgCredibilityModel =
  mongoose.models.TgCredibility ||
  mongoose.model('TgCredibility', TgCredibilitySchema);
