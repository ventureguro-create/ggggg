/**
 * tg.network_alpha_token.model.ts
 * Token-level network alpha summary
 */
import mongoose, { Schema } from 'mongoose';

const TgNetworkAlphaTokenSchema = new Schema(
  {
    token: { type: String, index: true, unique: true },

    lookbackDays: Number,

    mentionsCount: Number,
    channelsCount: Number,

    firstMentionAt: Date,
    p50MentionDelayHours: Number,
    p90MentionDelayHours: Number,

    success: {
      max7dReturn: Number,
      qualified: Boolean,
    },

    firstMentions: [
      {
        username: String,
        mentionedAt: Date,
        delayHours: Number,
      },
    ],

    computedAt: { type: Date, index: true },
  },
  { timestamps: true, collection: 'tg_network_alpha_tokens' }
);

export const TgNetworkAlphaTokenModel =
  mongoose.models.TgNetworkAlphaToken ||
  mongoose.model('TgNetworkAlphaToken', TgNetworkAlphaTokenSchema);
