/**
 * Job Lock Model
 * Collection: tg_job_locks
 */
import mongoose, { Schema } from 'mongoose';

const TgJobLockSchema = new Schema(
  {
    name: { type: String, index: true, unique: true },
    owner: { type: String, index: true },
    lockedUntil: { type: Date, index: true },
    meta: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const TgJobLockModel =
  mongoose.models.TgJobLock || mongoose.model('TgJobLock', TgJobLockSchema);
