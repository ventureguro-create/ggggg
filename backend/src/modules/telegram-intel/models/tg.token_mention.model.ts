/**
 * tg_token_mention.model.ts
 * Token mentions extracted from Telegram posts
 * Phase 3: Alpha & Credibility Engine
 */
import mongoose, { Schema } from 'mongoose';

const TgTokenMentionSchema = new Schema(
  {
    username: { type: String, index: true },      // channel username
    token: { type: String, index: true },         // normalized ticker (UPPER)
    mentionedAt: { type: Date, index: true },

    postId: { type: String, index: true },        // `${username}:${messageId}`
    messageId: { type: Number, index: true },

    context: {
      snippet: String,                            // small context window
      source: { type: String, enum: ['cashtag', 'hashtag', 'plain'], index: true },
      confidence: Number,                         // 0..1
    },

    // future fields (Phase 3 Step 2+)
    evaluated: { type: Boolean, default: false, index: true },
    priceAtMention: Number,
    returns: {
      r24h: Number,
      r7d: Number,
      r30d: Number,
      max7d: Number,
    },
  },
  { timestamps: true, collection: 'tg_token_mentions' }
);

// idempotency: one token mention per post per token
TgTokenMentionSchema.index({ postId: 1, token: 1 }, { unique: true });

// fast queries by channel-window
TgTokenMentionSchema.index({ username: 1, mentionedAt: -1 });

// for evaluation job
TgTokenMentionSchema.index({ evaluated: 1, mentionedAt: -1 });

export const TgTokenMentionModel =
  mongoose.models.TgTokenMention || mongoose.model('TgTokenMention', TgTokenMentionSchema);
