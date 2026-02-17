/**
 * Impact Types - PHASE C2
 * ML2 Impact measurement types
 */

export interface ImpactMetrics {
  window: string;
  totalAlerts: number;
  sentBeforeMl: number;
  sentAfterMl: number;
  lowPriorityAfterMl: number;
  suppressedByMl: number;
  downgradedByMl: number;
  noiseReduction: number | null;
  realityAlignment: number | null;
  agreementRate: number | null;
  impactScore: number | null;
}

export interface RealityStats {
  confirmed: number;
  contradicted: number;
  noData: number;
}

export interface AgreementStats {
  totalRated: number;
  correct: number;
  falsePositive: number;
  agreementRate: number | null;
}

console.log('[ML2/Impact] Types loaded (Phase C2)');
