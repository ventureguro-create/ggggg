/**
 * On-chain Adapter Config Store
 */

import type { Collection, Db } from 'mongodb';
import { OnchainAdapterMode } from '../contracts/onchain.contract.js';

export type OnchainAdapterConfig = {
  _id: 'onchain_adapter';
  enabled: boolean;
  mode: OnchainAdapterMode;
  confidence_floor_0_1: number;
  max_assets_per_request: number;
  max_windows_per_request: number;
  // E1: Engine connection settings
  engineBaseUrl?: string;
  engineApiKey?: string;
  engineConnected?: boolean;
  engineLastCheck?: string;
  updatedAt: string;
};

export class OnchainAdapterConfigStore {
  private col: Collection<OnchainAdapterConfig>;

  constructor(db: Db) {
    this.col = db.collection<OnchainAdapterConfig>('connections_onchain_adapter_config');
  }

  async getOrCreate(): Promise<OnchainAdapterConfig> {
    const existing = await this.col.findOne({ _id: 'onchain_adapter' });
    if (existing) return existing;

    const doc: OnchainAdapterConfig = {
      _id: 'onchain_adapter',
      enabled: true,
      mode: 'MOCK',
      confidence_floor_0_1: 0.35,
      max_assets_per_request: 5,
      max_windows_per_request: 6,
      updatedAt: new Date().toISOString(),
    };

    await this.col.insertOne(doc);
    return doc;
  }

  async patch(patch: Partial<Omit<OnchainAdapterConfig, '_id'>>): Promise<OnchainAdapterConfig> {
    const updatedAt = new Date().toISOString();
    await this.col.updateOne(
      { _id: 'onchain_adapter' },
      { $set: { ...patch, updatedAt } },
      { upsert: true }
    );
    return this.getOrCreate();
  }
}
