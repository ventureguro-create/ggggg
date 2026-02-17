/**
 * Reality Layer - Type Definitions
 * 
 * PHASE E2: Reality Gate + E4: Leaderboard
 */

export type RealityVerdict = 'CONFIRMS' | 'CONTRADICTS' | 'NO_DATA';

export type WalletBadge = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type RealityLevel = 'ELITE' | 'STRONG' | 'MIXED' | 'RISKY' | 'INSUFFICIENT';

export interface RealityResult {
  verdict: RealityVerdict;
  score_0_1: number;
  evidence: string[];
  window?: 'T0' | 'T4H' | 'T24H';
}

export interface WalletCredibility {
  badge: WalletBadge;
  score_0_1: number;
  linkedWalletsCount: number;
  evidence?: string[];
}

export interface RealityGateDecision {
  originalDecision: string;
  finalDecision: string;
  realityScore: number;
  verdict: RealityVerdict;
  walletBadge: WalletBadge;
  flags: string[];
  reason: string;
}

export interface RealityLedgerEntry {
  eventId: string;
  actorId: string;
  symbol?: string;
  verdict: RealityVerdict;
  score_0_1: number;
  walletBadge: WalletBadge;
  window: 'T0' | 'T4H' | 'T24H';
  evidence: string[];
  ts: Date;
}

export interface LeaderboardEntry {
  actorId: string;
  username?: string;
  name?: string;
  avatar?: string;
  confirms: number;
  contradicts: number;
  nodata: number;
  total: number;
  sample: number;
  realityScore: number;
  level: RealityLevel;
  authority_0_1: number;
  lastTs: Date;
}

export interface LeaderboardConfig {
  k_sample: number;              // 12
  contradict_penalty: number;    // 1.25
  min_sample: number;            // 3
  taxonomy_weight_threshold: number; // 0.55
}

export const DEFAULT_LEADERBOARD_CONFIG: LeaderboardConfig = {
  k_sample: 12,
  contradict_penalty: 1.25,
  min_sample: 3,
  taxonomy_weight_threshold: 0.55,
};
