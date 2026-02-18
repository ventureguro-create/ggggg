/**
 * tg.network_alpha_channel.model.ts
 * Channel-level network alpha scores
 */
import mongoose, { Schema } from 'mongoose';

const TgNetworkAlphaChannelSchema = new Schema(
  {
    username: { type: String, index: true, unique: true },

    networkAlphaScore: { type: Number, index: true }, // 0..100
    tier: { type: String, index: true }, // S/A/B/C/D

    stats: {
      lookbackDays: Number,
      tokensCovered: Number,
      successfulTokens: Number,

      earlyHitRate: Number, // successful tokens where channel was early
      avgEarlyPercentile: Number, // avg percentile (0..1), lower is better
      qualityWeightedEarliness: Number, // 0..1
      coverageScore: Number, // 0..1
    },

    explain: Schema.Types.Mixed,

    computedAt: { type: Date, index: true },
  },
  { timestamps: true, collection: 'tg_network_alpha_channels' }
);

TgNetworkAlphaChannelSchema.index({ networkAlphaScore: -1 });

export const TgNetworkAlphaChannelModel =
  mongoose.models.TgNetworkAlphaChannel ||
  mongoose.model('TgNetworkAlphaChannel', TgNetworkAlphaChannelSchema);
