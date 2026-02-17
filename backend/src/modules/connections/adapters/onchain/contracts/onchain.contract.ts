/**
 * On-chain Adapter Contract
 * 
 * Defines the interface that Connections Core uses to interact with on-chain data.
 * Connections NEVER talks directly to on-chain - only through this adapter.
 */

import { OnchainResolveRequest, OnchainResolveResponse, OnchainSnapshot } from './onchain.types.js';

export type OnchainAdapterMode = 'OFF' | 'MOCK' | 'ENGINE_READONLY';

export type OnchainAdapterStatus = {
  enabled: boolean;
  mode: OnchainAdapterMode;
  read_only: true;
  data_health: {
    last_ok_at?: string;
    last_error?: string;
  };
  limits: {
    max_assets_per_request: number;
    max_windows_per_request: number;
  };
  defaults: {
    confidence_floor_0_1: number;
  };
  // E1: Engine connection info
  engine?: {
    baseUrl: string;
    connected: boolean;
    lastCheck?: string;
  };
};

export interface IOnchainAdapter {
  getStatus(): Promise<OnchainAdapterStatus>;
  getSnapshot(asset: string, timestampIso?: string): Promise<OnchainSnapshot>;
  resolve(req: OnchainResolveRequest): Promise<OnchainResolveResponse>;
}
