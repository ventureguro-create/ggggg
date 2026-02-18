/**
 * tg.alpha_score.model.ts
 * Alpha Score v2 - Institutional grade scoring
 * Phase 3 Step 3 v2
 */
import mongoose, { Schema } from 'mongoose';

const TgAlphaScoreSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },

    alphaScore: { type: Number, default: 0, index: true }, // 0..100
    credibilityScore: { type: Number, default: 0 }, // placeholder for Step 4

    sampleSize: { type: Number, default: 0 },
    evaluatedMentions: { type: Number, default: 0 },

    breakdown: {
      n: Number,
      hit7: Number,
      hit24: Number,
      avg7: Number,
      std7: Number,
      rar: Number,
      rarScore: Number,
      earlyness: Number,
      stability: Number,
      consistency: Number,
      mentionsPerWeek: Number,
      spamPenalty: Number,
      drawdownPenalty: Number,
      sampleConfidence: Number,
      base: Number,
      penalty: Number,
      alpha01: Number,
      reason: String, // 'low_sample' | 'computed'
    },

    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'tg_alpha_scores' }
);

TgAlphaScoreSchema.index({ alphaScore: -1 });

export const TgAlphaScoreModel =
  mongoose.models.TgAlphaScore ||
  mongoose.model('TgAlphaScore', TgAlphaScoreSchema);
