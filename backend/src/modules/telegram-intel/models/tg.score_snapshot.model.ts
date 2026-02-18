/**
 * tg.score_snapshot.model.ts
 * Daily score snapshots for temporal analysis
 */
import mongoose, { Schema } from 'mongoose';

const TgScoreSnapshotSchema = new Schema(
  {
    username: { type: String, index: true },

    day: { type: String, index: true }, // YYYY-MM-DD (UTC)

    config: {
      key: String,
      version: Number,
    },

    scores: {
      intelScore: Number,
      baseScore: Number,
      alphaScore: Number,
      credibilityScore: Number,
      networkAlphaScore: Number,
      fraudRisk: Number,
    },

    tiers: {
      intelTier: String,
      credibilityTier: String,
      networkAlphaTier: String,
    },

    meta: Schema.Types.Mixed,

    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false, collection: 'tg_score_snapshots' }
);

TgScoreSnapshotSchema.index({ username: 1, day: 1 }, { unique: true });
TgScoreSnapshotSchema.index({ day: 1, 'scores.intelScore': -1 });

export const TgScoreSnapshotModel =
  mongoose.models.TgScoreSnapshot ||
  mongoose.model('TgScoreSnapshot', TgScoreSnapshotSchema);
