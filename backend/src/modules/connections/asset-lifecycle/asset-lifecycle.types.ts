/**
 * БЛОК 14 — Asset Lifecycle State (ALS)
 * Где актив находится в своём жизненном цикле
 */

export type LifecyclePhase = 'ACCUMULATION' | 'IGNITION' | 'EXPANSION' | 'DISTRIBUTION';

export interface ALSScores {
  accumulation: number;
  ignition: number;
  expansion: number;
  distribution: number;
}

export interface AssetLifecycleState {
  _id?: any;
  asset: string; // e.g., "SOL"
  state: LifecyclePhase;
  confidence: number; // 0..1
  scores: ALSScores;
  window: '1h' | '4h' | '24h';
  timestamp: Date;
  createdAt: Date;
}

export interface ExchangeFeatures {
  priceSlope: number; // direction
  volumeDelta: number; // interest
  oiDelta: number; // new money
  fundingRate: number; // crowd bias
  volatilityState: 'compressed' | 'expanding' | 'normal';
  liqBias: 'longs' | 'shorts' | 'balanced';
  participationBreadth: number; // 0..1
  failedBreakouts: number;
}
