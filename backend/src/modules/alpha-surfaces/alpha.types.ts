/**
 * БЛОК 20 — Alpha Surfaces
 * Market × Narrative × Influencer пересечения
 */

export type AlphaDirection = 'BUY' | 'SELL' | 'AVOID';
export type AlphaSurfaceType = 'IMMEDIATE_MOMENTUM' | 'NARRATIVE_ROTATION' | 'CROWDED_TRADE';

export interface AlphaCandidate {
  _id?: any;
  asset: string;
  narrative: string;
  
  marketScore: number; // 0..1
  narrativeScore: number; // 0..1
  influencerScore: number; // 0..1
  
  alphaScore: number; // final 0..1
  direction: AlphaDirection;
  horizon: '1h' | '4h' | '24h';
  surface: AlphaSurfaceType;
  
  explanation: string[];
  timestamp: Date;
  createdAt: Date;
}

export interface AlphaOutcome {
  _id?: any;
  alphaId: string;
  asset: string;
  horizon: '1h' | '4h' | '24h';
  
  result: 'TP' | 'FP' | 'WEAK' | 'NO_MOVE';
  returnPct: number;
  maxFavorableMove: number;
  maxAdverseMove: number;
  
  createdAt: Date;
}

export interface AlphaSystemStats {
  hitRate: number;
  avgReturn: number;
  falseAlphaRate: number;
  narrativeEfficiency: number;
  influencerROI: number;
}
