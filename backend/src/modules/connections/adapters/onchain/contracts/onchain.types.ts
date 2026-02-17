/**
 * On-chain Adapter Types
 * 
 * PHASE A: Read-only adapter for on-chain metrics
 */

export type OnchainVerdict = 'CONFIRMS' | 'CONTRADICTS' | 'NO_DATA';

export type OnchainSnapshot = {
  asset: string;                 // "SOL", "ETH", ...
  timestamp: string;             // ISO
  window?: { from: string; to: string };

  // normalized metrics
  flow_score_0_1: number;        // 0..1 accumulation signal
  exchange_pressure_m1_1: number;// -1..1 (positive = sell pressure)
  whale_activity_0_1: number;    // 0..1
  network_heat_0_1: number;      // 0..1
  velocity_0_1?: number;         // 0..1
  distribution_skew_m1_1?: number;// -1..1

  verdict: OnchainVerdict;
  confidence_0_1: number;        // 0..1
  warnings?: string[];
  source?: {
    name: string;
    version?: string;
  };
};

export type OnchainResolveRequest = {
  asset: string;
  eventTimestamp: string;        // ISO
  windows?: Array<{ from: string; to: string; label?: string }>;
};

export type OnchainResolveResponse = {
  asset: string;
  baseTimestamp: string;
  snapshots: OnchainSnapshot[];
};
