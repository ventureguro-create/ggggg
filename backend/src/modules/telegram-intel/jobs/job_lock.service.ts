/**
 * Job Lock Service
 */
import crypto from 'node:crypto';
import { TgJobLockModel } from '../models/tg.job_lock.model.js';

export class JobLockService {
  private owner = crypto.randomBytes(10).toString('hex');

  async acquire(name: string, ttlMs: number) {
    const now = new Date();
    const until = new Date(Date.now() + ttlMs);

    const res = await TgJobLockModel.findOneAndUpdate(
      {
        name,
        $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }],
      },
      { $set: { name, owner: this.owner, lockedUntil: until } },
      { upsert: true, new: true }
    ).lean();

    return res?.owner === this.owner;
  }

  async renew(name: string, ttlMs: number) {
    const until = new Date(Date.now() + ttlMs);
    await TgJobLockModel.updateOne({ name, owner: this.owner }, { $set: { lockedUntil: until } });
  }

  async release(name: string) {
    await TgJobLockModel.updateOne(
      { name, owner: this.owner },
      { $set: { lockedUntil: new Date(0) } }
    );
  }

  getOwner() {
    return this.owner;
  }
}
