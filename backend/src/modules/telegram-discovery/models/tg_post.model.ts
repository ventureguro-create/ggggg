/**
 * TG Post Model (EXTENDED)
 * Collection: tg_posts
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgPost extends Document {
  postId: string;
  channelId: string;
  channelUsername: string;
  messageId: number;
  
  // Content
  text?: string;
  mediaType?: 'photo' | 'video' | 'document' | 'poll' | 'none';
  hasForward: boolean;
  forwardedFrom?: {
    id?: string;
    username?: string;
    title?: string;
  } | null;
  
  // Metrics
  views: number;
  forwards?: number;
  replies?: number;
  reactionsCount?: number;
  
  // Extracted data
  mentions?: string[];
  fingerprint?: string;  // For cross-reuse detection
  
  // Timestamps
  date: Date;
  postedAt: Date;
  ingestedAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const TgPostSchema = new Schema<ITgPost>({
  postId: { type: String, required: true },
  channelId: { type: String, index: true },
  channelUsername: { type: String, required: true, index: true },
  messageId: { type: Number, required: true },
  
  text: String,
  mediaType: {
    type: String,
    enum: ['photo', 'video', 'document', 'poll', 'none'],
    default: 'none'
  },
  hasForward: { type: Boolean, default: false },
  forwardedFrom: {
    id: String,
    username: String,
    title: String,
  },
  
  views: { type: Number, default: 0 },
  forwards: Number,
  replies: Number,
  reactionsCount: Number,
  
  mentions: [String],
  fingerprint: { type: String, index: true },
  
  date: { type: Date, required: true, index: true },
  postedAt: { type: Date, required: true },
  ingestedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'tg_posts'
});

// Indexes
TgPostSchema.index({ channelUsername: 1, messageId: 1 }, { unique: true });
TgPostSchema.index({ postedAt: -1 });
TgPostSchema.index({ fingerprint: 1, date: 1 });

export const TgPostModel = model<ITgPost>('TgPost', TgPostSchema);
