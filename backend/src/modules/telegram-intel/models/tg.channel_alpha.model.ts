/**
 * tg_channel_alpha.model.ts
 * Channel Alpha Scores - Phase 3 Step 3
 * 
 * Stores calculated alpha metrics for each channel:
 * - successRate: % of mentions with >10% gain at 7d
 * - avgReturn7d: average return across all evaluated mentions
 * - earlynessFactor: how early channel mentions tokens (vs first mention anywhere)
 * - consistency: variance-adjusted performance metric
 * - alphaScore: composite score 0..100
 */
import mongoose, { Schema } from 'mongoose';

const TgChannelAlphaSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },

    // Core metrics
    successRate: { type: Number, default: 0 },     // 0..1 (% with >10% gain at 7d)
    avgReturn7d: { type: Number, default: 0 },     // average % return at 7d
    avgReturn30d: { type: Number, default: 0 },    // average % return at 30d
    
    // Advanced metrics
    earlynessFactor: { type: Number, default: 0 }, // 0..1 (higher = earlier mentions)
    consistency: { type: Number, default: 0 },     // 0..1 (lower variance = higher)
    hitRate: { type: Number, default: 0 },         // 0..1 (% with any positive return)
    
    // Composite score
    alphaScore: { type: Number, default: 0, index: true }, // 0..100

    // Stats
    totalMentions: { type: Number, default: 0 },
    evaluatedMentions: { type: Number, default: 0 },
    successfulMentions: { type: Number, default: 0 }, // >10% at 7d
    
    // Top performers
    bestMention: {
      token: String,
      mentionedAt: Date,
      return7d: Number,
    },
    
    // Distribution data for consistency calc
    returnDistribution: {
      positive: { type: Number, default: 0 },   // count of positive returns
      negative: { type: Number, default: 0 },   // count of negative returns
      stdDev: { type: Number, default: 0 },     // standard deviation
    },

    // Timestamps
    lastCalculated: { type: Date, default: Date.now },
    calculationWindow: { type: Number, default: 90 }, // days used for calc
  },
  { timestamps: true, collection: 'tg_channel_alpha' }
);

// Fast lookups by score
TgChannelAlphaSchema.index({ alphaScore: -1, successRate: -1 });
TgChannelAlphaSchema.index({ lastCalculated: 1 });

export const TgChannelAlphaModel =
  mongoose.models.TgChannelAlpha || mongoose.model('TgChannelAlpha', TgChannelAlphaSchema);
