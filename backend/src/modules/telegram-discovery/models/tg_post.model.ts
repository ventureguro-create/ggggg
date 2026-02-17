/**
 * TG Post Model
 * Collection: tg_posts
 * 
 * Хранит посты из Telegram каналов
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgPost extends Document {
  postId: string;              // Telegram message ID
  channelId: string;           // Reference to channel
  channelUsername: string;     // @username for quick access
  
  // Content
  text?: string;
  mediaType?: 'photo' | 'video' | 'document' | 'poll' | 'none';
  hasForward: boolean;
  forwardFrom?: string;        // Forwarded from channel
  
  // Metrics at ingestion time
  views: number;
  forwards?: number;
  reactions?: number;
  comments?: number;
  
  // Timestamps
  postedAt: Date;
  ingestedAt: Date;
  
  // Analysis
  sentiment?: 'positive' | 'negative' | 'neutral';
  topics?: string[];
  mentionedTokens?: string[];  // $BTC, $ETH etc
  mentionedChannels?: string[]; // @channel mentions
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const TgPostSchema = new Schema<ITgPost>({
  postId: { type: String, required: true },
  channelId: { type: String, required: true, index: true },
  channelUsername: { type: String, required: true, index: true },
  
  text: String,
  mediaType: {
    type: String,
    enum: ['photo', 'video', 'document', 'poll', 'none'],
    default: 'none'
  },
  hasForward: { type: Boolean, default: false },
  forwardFrom: String,
  
  views: { type: Number, default: 0 },
  forwards: Number,
  reactions: Number,
  comments: Number,
  
  postedAt: { type: Date, required: true, index: true },
  ingestedAt: { type: Date, default: Date.now },
  
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral']
  },
  topics: [String],
  mentionedTokens: [String],
  mentionedChannels: [String],
}, {
  timestamps: true,
  collection: 'tg_posts'
});

// Compound unique index
TgPostSchema.index({ channelId: 1, postId: 1 }, { unique: true });
TgPostSchema.index({ postedAt: -1 });
TgPostSchema.index({ mentionedTokens: 1 });

export const TgPostModel = model<ITgPost>('TgPost', TgPostSchema);
