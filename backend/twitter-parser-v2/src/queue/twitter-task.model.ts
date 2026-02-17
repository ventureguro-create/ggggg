import mongoose, { Schema, Document } from 'mongoose';

export type TaskStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
export type TaskType = 'SEARCH' | 'ACCOUNT_TWEETS';

export interface ITwitterTask extends Document {
  type: TaskType;
  payload: Record<string, any>;
  status: TaskStatus;
  attempts: number;
  lastError?: string;
  lockedBy?: string;
  lockedAt?: Date;
  nextRunAt: Date;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const TwitterTaskSchema = new Schema<ITwitterTask>(
  {
    type: {
      type: String,
      required: true,
      enum: ['SEARCH', 'ACCOUNT_TWEETS'],
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      default: 'PENDING',
      enum: ['PENDING', 'RUNNING', 'DONE', 'FAILED'],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: String,
    lockedBy: String,
    lockedAt: Date,
    nextRunAt: {
      type: Date,
      default: () => new Date(),
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
TwitterTaskSchema.index({ status: 1, nextRunAt: 1 });
TwitterTaskSchema.index({ lockedAt: 1 });

export const TwitterTaskModel = mongoose.model<ITwitterTask>(
  'TwitterTask',
  TwitterTaskSchema
);
