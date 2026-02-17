/**
 * On-chain Mock Runtime
 * 
 * Deterministic mock for testing without real on-chain data.
 */

import { OnchainSnapshot, OnchainVerdict, OnchainResolveRequest, OnchainResolveResponse } from '../contracts/onchain.types.js';

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function seeded(asset: string, t: string) {
  const s = `${asset}|${t}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h / 0xffffffff;
}

export class OnchainMockRuntime {
  async getSnapshot(asset: string, timestampIso: string): Promise<OnchainSnapshot> {
    const r = seeded(asset, timestampIso);

    const flow = clamp01(0.2 + 0.7 * r);
    const whale = clamp01(0.15 + 0.75 * (1 - r));
    const heat = clamp01(0.25 + 0.6 * (r * 0.9));
    const exch = (r - 0.5) * 2; // -1..1

    const verdict: OnchainVerdict =
      flow > 0.65 && whale > 0.55 ? 'CONFIRMS'
      : flow < 0.35 && exch > 0.35 ? 'CONTRADICTS'
      : 'NO_DATA';

    const confidence = clamp01(0.35 + 0.55 * Math.abs(flow - 0.5));

    return {
      asset,
      timestamp: timestampIso,
      flow_score_0_1: flow,
      exchange_pressure_m1_1: Math.max(-1, Math.min(1, exch)),
      whale_activity_0_1: whale,
      network_heat_0_1: heat,
      verdict,
      confidence_0_1: confidence,
      source: { name: 'onchain-mock', version: '1.0' },
      warnings: verdict === 'NO_DATA' ? ['MOCK_NEUTRAL'] : [],
    };
  }

  async resolve(req: OnchainResolveRequest): Promise<OnchainResolveResponse> {
    const baseTs = req.eventTimestamp;
    const windows = req.windows?.length
      ? req.windows
      : [{ from: baseTs, to: baseTs, label: 'T0' }];

    const snaps: OnchainSnapshot[] = [];
    for (const w of windows.slice(0, 6)) {
      const s = await this.getSnapshot(req.asset, w.to);
      snaps.push({ ...s, window: { from: w.from, to: w.to } });
    }

    return { asset: req.asset, baseTimestamp: baseTs, snapshots: snaps };
  }
}
