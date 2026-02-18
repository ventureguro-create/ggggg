/**
 * tg.intel_ranking.model.ts
 * Unified Intelligence Ranking - final score
 * Phase 3 Step 5
 */
import mongoose, { Schema } from 'mongoose';

const TgIntelRankingSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },

    intelScore: { type: Number, default: 0, index: true }, // 0..100
    tier: { type: String, index: true }, // S/A/B/C/D

    components: {
      baseScore: Number,
      alphaScore: Number,
      credibilityScore: Number,
      fraudRisk: Number,
      reach: Number,
      engagement: Number,
    },

    penalties: {
      fraudPenalty: Number,
      lowCredPenalty: Number,
      lowSamplePenalty: Number,
    },

    explain: Schema.Types.Mixed,

    computedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'tg_intel_rankings' }
);

TgIntelRankingSchema.index({ intelScore: -1 });

export const TgIntelRankingModel =
  mongoose.models.TgIntelRanking ||
  mongoose.model('TgIntelRanking', TgIntelRankingSchema);
