/**
 * БЛОК 16 — Narrative Intelligence Layer
 * Понять ЧТО ИЩУТ, ЧТО ОБСУЖДАЮТ, ЧТО ХАЙПУЕТ
 */

export type NarrativeState = 'SEEDING' | 'IGNITION' | 'EXPANSION' | 'SATURATION' | 'DECAY';
export type NarrativeAtomType = 'token' | 'topic' | 'concept';

export interface NarrativeAtom {
  _id?: any;
  keyword: string; // "AI agents", "RWA", "Restaking"
  type: NarrativeAtomType;
  firstSeenAt: Date;
  mentionsCount: number;
  uniqueAuthors: number;
  weightedAttention: number; // 0..1
  updatedAt: Date;
}

export interface Narrative {
  _id?: any;
  key: string; // "AI_AGENTS"
  displayName: string;
  state: NarrativeState;
  nms: number; // Narrative Momentum Score 0..1
  velocity: number; // mentions growth rate
  influencerWeight: number;
  clusterSpread: number;
  noveltyFactor: number;
  linkedTokens: string[]; // ["FET", "AGIX", "RNDR"]
  topDrivers: string[]; // influencer IDs
  window: '1h' | '4h' | '24h' | '7d';
  timestamp: Date;
  createdAt: Date;
}

export interface NarrativeBinding {
  _id?: any;
  narrativeKey: string; // "AI_AGENTS"
  symbol: string; // "FET"
  weight: number; // 0..1 (strength of binding)
  reason: 'co_mention' | 'influencers' | 'manual';
  updatedAt: Date;
}

export interface NarrativeOutcome {
  _id?: any;
  narrativeKey: string;
  symbol: string;
  eventAt: Date;
  window: '1h' | '4h' | '24h';
  nms: number;
  socialWeight: number;
  retPct: number; // return percentage
  realized: 'UP' | 'DOWN' | 'FLAT';
  label: 'TP' | 'FP' | 'WEAK' | 'NOISE';
  createdAt: Date;
}
