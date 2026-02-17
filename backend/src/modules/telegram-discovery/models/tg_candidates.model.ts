/**
 * TG Candidates Model
 * Collection: tg_candidates
 * 
 * Очередь кандидатов на добавление (discovered but not yet processed)
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgCandidate extends Document {
  username: string;            // @username (unique)
  
  // Discovery context
  discoveredFrom: string;      // Source channel username
  discoveryMethod: 'forward' | 'mention';
  discoveredAt: Date;
  
  // Processing status
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'error';
  processedAt?: Date;
  errorMessage?: string;
  
  // Priority
  priority: number;            // Higher = process first
  mentionCount: number;        // How many times seen
  
  // Quick validation (pre-processing)
  preValidation?: {
    exists: boolean;
    isChannel: boolean;
    isPublic: boolean;
    subscriberCount?: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const TgCandidateSchema = new Schema<ITgCandidate>({
  username: { type: String, required: true, unique: true, index: true },
  
  discoveredFrom: { type: String, required: true },
  discoveryMethod: {
    type: String,
    enum: ['forward', 'mention'],
    required: true
  },
  discoveredAt: { type: Date, default: Date.now },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'approved', 'rejected', 'error'],
    default: 'pending',
    index: true
  },
  processedAt: Date,
  errorMessage: String,
  
  priority: { type: Number, default: 0, index: true },
  mentionCount: { type: Number, default: 1 },
  
  preValidation: {
    exists: Boolean,
    isChannel: Boolean,
    isPublic: Boolean,
    subscriberCount: Number,
  },
}, {
  timestamps: true,
  collection: 'tg_candidates'
});

// Index for processing queue
TgCandidateSchema.index({ status: 1, priority: -1, discoveredAt: 1 });

export const TgCandidateModel = model<ITgCandidate>('TgCandidate', TgCandidateSchema);
