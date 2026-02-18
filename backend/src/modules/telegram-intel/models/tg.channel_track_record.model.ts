/**
 * tg.channel_track_record.model.ts
 * Channel Track Record - historical performance stats
 * Phase 3 Step 3 v2 (Institutional)
 */
import mongoose, { Schema } from 'mongoose';

const TgChannelTrackRecordSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },

    // Sample stats
    totalMentions: { type: Number, default: 0 },
    evaluatedMentions: { type: Number, default: 0 },
    mentionsPerWeek: { type: Number, default: 0 },

    // Return distribution
    avgReturn7d: { type: Number, default: 0 },
    avgReturn24h: { type: Number, default: 0 },
    returnStd7d: { type: Number, default: 0 },
    returnStd24h: { type: Number, default: 0 },

    // Best/Worst
    bestReturn7d: { type: Number, default: 0 },
    worstReturn7d: { type: Number, default: 0 },

    // Consistency (0..1)
    consistency: { type: Number, default: 0 },

    // Quartiles
    q25Return7d: { type: Number, default: 0 },
    q50Return7d: { type: Number, default: 0 },
    q75Return7d: { type: Number, default: 0 },

    computedAt: { type: Date, default: Date.now },
    windowDays: { type: Number, default: 90 },
  },
  { timestamps: true, collection: 'tg_channel_track_records' }
);

export const TgChannelTrackRecordModel =
  mongoose.models.TgChannelTrackRecord ||
  mongoose.model('TgChannelTrackRecord', TgChannelTrackRecordSchema);
