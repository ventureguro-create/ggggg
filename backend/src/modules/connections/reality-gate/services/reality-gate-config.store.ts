/**
 * Reality Gate Config Store
 */

import { Db, Collection } from 'mongodb';
import { RealityGatePolicy, DEFAULT_GATE_POLICY } from '../contracts/reality-gate.types.js';

export type RealityGateConfig = RealityGatePolicy & {
  _id: 'reality_gate';
  updatedAt: string;
};

export class RealityGateConfigStore {
  private col: Collection<RealityGateConfig>;

  constructor(db: Db) {
    this.col = db.collection<RealityGateConfig>('connections_reality_gate_config');
  }

  async getOrCreate(): Promise<RealityGateConfig> {
    const existing = await this.col.findOne({ _id: 'reality_gate' });
    if (existing) return existing;

    const doc: RealityGateConfig = {
      _id: 'reality_gate',
      ...DEFAULT_GATE_POLICY,
      updatedAt: new Date().toISOString(),
    };

    await this.col.insertOne(doc);
    return doc;
  }

  async patch(patch: Partial<RealityGatePolicy>): Promise<RealityGateConfig> {
    const updatedAt = new Date().toISOString();
    await this.col.updateOne(
      { _id: 'reality_gate' },
      { $set: { ...patch, updatedAt } },
      { upsert: true }
    );
    return this.getOrCreate();
  }
}
