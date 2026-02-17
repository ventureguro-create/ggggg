/**
 * Reality Ledger Store
 */

import { Db, Collection } from 'mongodb';
import { RealityLedgerEntry } from '../contracts/reality-ledger.types.js';

export class RealityLedgerStore {
  private col: Collection<RealityLedgerEntry>;

  constructor(db: Db) {
    this.col = db.collection<RealityLedgerEntry>('connections_reality_ledger');
    this.col.createIndex({ eventId: 1 }, { unique: true }).catch(() => {});
    this.col.createIndex({ actorId: 1, evaluatedAt: -1 }).catch(() => {});
    this.col.createIndex({ asset: 1, evaluatedAt: -1 }).catch(() => {});
  }

  async upsert(entry: RealityLedgerEntry) {
    const { _id, ...rest } = entry;
    await this.col.updateOne(
      { eventId: entry.eventId },
      { $set: rest },
      { upsert: true }
    );
  }

  async getByEvent(eventId: string): Promise<RealityLedgerEntry | null> {
    return this.col.findOne({ eventId });
  }

  async listByAsset(asset: string, limit = 50): Promise<RealityLedgerEntry[]> {
    return this.col.find({ asset }).sort({ evaluatedAt: -1 }).limit(limit).toArray();
  }

  async listByActor(actorId: string, limit = 50): Promise<RealityLedgerEntry[]> {
    return this.col.find({ actorId }).sort({ evaluatedAt: -1 }).limit(limit).toArray();
  }

  async getStats(): Promise<{ total: number; confirmed: number; contradicted: number; noData: number }> {
    const pipeline = [
      {
        $group: {
          _id: '$onchain.verdict',
          count: { $sum: 1 },
        },
      },
    ];
    const results = await this.col.aggregate(pipeline).toArray();
    const stats = { total: 0, confirmed: 0, contradicted: 0, noData: 0 };
    for (const r of results) {
      stats.total += r.count;
      if (r._id === 'CONFIRMED') stats.confirmed = r.count;
      if (r._id === 'CONTRADICTED') stats.contradicted = r.count;
      if (r._id === 'NO_DATA') stats.noData = r.count;
    }
    return stats;
  }
}
