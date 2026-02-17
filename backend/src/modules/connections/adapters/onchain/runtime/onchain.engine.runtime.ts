/**
 * On-chain Engine Runtime (READ-ONLY)
 * 
 * Port to connect to existing on-chain engine.
 * Adapter pattern - Connections never knows implementation details.
 */

import { OnchainResolveRequest, OnchainResolveResponse, OnchainSnapshot } from '../contracts/onchain.types.js';

// Port interface - to be implemented by actual on-chain module
export interface IOnchainEnginePort {
  getMarketSnapshot(asset: string, timestampIso?: string): Promise<any>;
  getWindowVerdict(asset: string, fromIso: string, toIso: string): Promise<any>;
}

export class OnchainEngineReadonlyRuntime {
  constructor(private readonly engine: IOnchainEnginePort) {}

  private mapSnapshot(asset: string, timestampIso: string, raw: any): OnchainSnapshot {
    return {
      asset,
      timestamp: raw?.timestamp ?? timestampIso,
      flow_score_0_1: raw?.flow_score_0_1 ?? 0.5,
      exchange_pressure_m1_1: raw?.exchange_pressure_m1_1 ?? 0,
      whale_activity_0_1: raw?.whale_activity_0_1 ?? 0.5,
      network_heat_0_1: raw?.network_heat_0_1 ?? 0.5,
      velocity_0_1: raw?.velocity_0_1,
      distribution_skew_m1_1: raw?.distribution_skew_m1_1,
      verdict: raw?.verdict ?? 'NO_DATA',
      confidence_0_1: raw?.confidence_0_1 ?? 0.35,
      warnings: raw?.warnings ?? [],
      source: { name: 'onchain-engine' },
    };
  }

  async getSnapshot(asset: string, timestampIso?: string): Promise<OnchainSnapshot> {
    const raw = await this.engine.getMarketSnapshot(asset, timestampIso);
    return this.mapSnapshot(asset, timestampIso ?? new Date().toISOString(), raw);
  }

  async resolve(req: OnchainResolveRequest): Promise<OnchainResolveResponse> {
    const windows = req.windows?.length
      ? req.windows
      : [{ from: req.eventTimestamp, to: req.eventTimestamp, label: 'T0' }];

    const snaps: OnchainSnapshot[] = [];
    for (const w of windows.slice(0, 6)) {
      const raw = await this.engine.getWindowVerdict(req.asset, w.from, w.to);
      snaps.push({
        ...this.mapSnapshot(req.asset, w.to, raw),
        window: { from: w.from, to: w.to },
      });
    }

    return { asset: req.asset, baseTimestamp: req.eventTimestamp, snapshots: snaps };
  }
}
