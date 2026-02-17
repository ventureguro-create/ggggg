/**
 * БЛОК 13 — Early Rotation Predictor (ERP)
 * Детектор ротаций ДО пампа
 */

export type ERPClass = 'IMMINENT' | 'BUILDING' | 'WATCH' | 'IGNORE';

export interface TensionNotes {
  volatility: 'compressed' | 'expanding' | 'normal';
  funding: 'positive_extreme' | 'negative_extreme' | 'neutral';
  opportunityGrowth: string; // e.g., "+38%"
  failedBreakouts: number;
}

export interface EarlyRotation {
  _id?: any;
  fromCluster: string;
  toCluster: string;
  erp: number; // 0..1 Early Rotation Probability
  class: ERPClass;
  tensionScore: number; // 0..1
  window: '1h' | '4h' | '24h';
  notes: TensionNotes;
  timestamp: Date;
  createdAt: Date;
}

export interface ClusterTensionInput {
  clusterId: string;
  momentumSlope: number;
  volumeSlope: number;
  oiSlope: number;
  fundingBias: number;
  volatilityCompression: number; // 0..1
  opportunityDensityTrend: number; // growth rate
  failedBreakouts: number;
}
