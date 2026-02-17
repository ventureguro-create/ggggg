/**
 * БЛОК 19 — Narrative ↔ Influencer Graph
 * Кто реально запускает нарративы
 */

export type InfluencerRole = 'DRIVER' | 'AMPLIFIER' | 'NOISE';

export interface InfluencerNarrativeContribution {
  _id?: any;
  influencerId: string;
  narrativeKey: string;
  weight: number; // 0..1 contribution share
  timestamp: Date;
}

export interface InfluencerNarrativeStats {
  _id?: any;
  influencerId: string;
  narrativeKey: string;
  eventsTriggered: number;
  tpCount: number;
  fpCount: number;
  avgReturn: number;
  insScore: number; // Influencer Narrative Score
  role: InfluencerRole;
  updatedAt: Date;
}

export interface InfluencerNarrativeEdge {
  from: string; // influencer ID
  to: string; // narrative key
  type: 'initiates' | 'amplifies' | 'late_noise';
  weight: number;
  tpFpRatio: number;
  avgReturn: number;
}
