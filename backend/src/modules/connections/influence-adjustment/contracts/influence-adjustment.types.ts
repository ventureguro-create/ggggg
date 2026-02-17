/**
 * Influence Adjustment Types
 * 
 * PHASE C: Reality-aware trust and penalties.
 */

export type InfluencePenaltyReason =
  | 'ONCHAIN_CONTRADICTED'
  | 'REPEATED_NO_CONFIRMATION'
  | 'CONSISTENTLY_CONFIRMED'
  | 'INSUFFICIENT_DATA'
  | 'CLEAN_RECORD';

export type InfluenceAdjustment = {
  actorId: string;
  baseInfluenceScore_0_1000: number;
  trustMultiplier_0_1: number;
  adjustedInfluenceScore_0_1000: number;
  reason: InfluencePenaltyReason;
  stats: {
    totalEvents: number;
    confirmed: number;
    contradicted: number;
    noData: number;
  };
  lastUpdatedAt: string;
};

export type InfluenceHistoryEntry = {
  actorId: string;
  eventId: string;
  verdict: 'CONFIRMED' | 'CONTRADICTED' | 'NO_DATA';
  evaluatedAt: string;
  confidence_0_1: number;
};
