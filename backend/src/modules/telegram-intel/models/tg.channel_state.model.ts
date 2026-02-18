/**
 * Channel State Model (cursor + timestamps)
 * Collection: tg_channel_states
 */
import mongoose, { Schema } from 'mongoose';

const TgChannelStateSchema = new Schema(
  {
    username: { type: String, index: true, unique: true },

    lastMessageId: { type: Number, default: 0 },
    lastIngestAt: Date,

    lastProfileAt: Date,
    lastError: String,
    errorCount: { type: Number, default: 0 },

    nextAllowedIngestAt: Date,
  },
  { timestamps: true }
);

export const TgChannelStateModel =
  mongoose.models.TgChannelState ||
  mongoose.model('TgChannelState', TgChannelStateSchema);
