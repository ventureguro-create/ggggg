/**
 * IPS Models - Event & Score Types
 * 
 * PHASE G: Informed Action Probability
 */

import { WindowKey } from '../constants/ips.constants';

// Event types captured from Twitter
export type EventType = 'tweet' | 'reply' | 'quote' | 'thread';

// Outcome classification
export type Outcome = 
  | 'NO_EFFECT'
  | 'POSITIVE_MOVE'
  | 'NEGATIVE_MOVE'
  | 'VOLATILITY_SPIKE';

// IPS Verdict
export type IPSVerdict = 'INFORMED' | 'MIXED' | 'NOISE' | 'INSUFFICIENT_DATA';

// Reality verdict from Reality Layer
export type RealityVerdict = 'CONFIRMS' | 'CONTRADICTS' | 'NO_DATA';

/**
 * Raw Twitter event captured
 */
export interface IPSEvent {
  id: string;
  actorId: string;
  source: 'twitter';
  eventType: EventType;
  asset?: string;           // BTC, ETH, SOL, ARB...
  projectId?: string;
  timestamp: number;
  contentHash?: string;     // For dedup
  reach?: number;           // Estimated reach
}

/**
 * Market snapshot at a point in time
 */
export interface MarketSnapshot {
  priceDelta: number;       // Percentage change
  volumeDelta: number;      // Volume change ratio
  volatility: number;       // Standard deviation measure
  onchainFlow?: number;     // Net flow direction
}

/**
 * IPS Factors - raw scores before weighting
 */
export interface IPSFactors {
  direction: number;        // 0-1: Direction match
  time: number;             // 0-1: Time advantage
  consistency: number;      // 0-1: Pattern consistency
  independence: number;     // 0-1: Crowd independence
  reality: number;          // 0-1: Reality layer score
}

/**
 * Reality data attached to event
 */
export interface IPSReality {
  verdict?: RealityVerdict;
  realityScore?: number;
  walletCredibility?: number;
}

/**
 * Complete IPS event record (stored in DB)
 */
export interface IPSEventRecord {
  eventId: string;
  actorId: string;
  asset: string;
  timestamp: number;
  window: WindowKey;
  outcome: Outcome;
  ips: number;
  verdict: IPSVerdict;
  factors: IPSFactors;
  snapshot: MarketSnapshot;
  reality?: IPSReality;
  meta?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Timeline entry for Admin UI
 */
export interface IPSTimelineEntry {
  eventId: string;
  actorId: string;
  asset: string;
  timestamp: number;
  window: WindowKey;
  outcome: Outcome;
  ips: number;
  verdict: IPSVerdict;
  factors: IPSFactors;
  snapshot: MarketSnapshot;
  reality?: IPSReality;
}

/**
 * Aggregated IPS stats for an actor
 */
export interface ActorIPSStats {
  actorId: string;
  totalEvents: number;
  avgIPS: number;
  p50: number;
  p90: number;
  verdict: IPSVerdict;
  windows: {
    '1h': { avgIPS: number; count: number };
    '4h': { avgIPS: number; count: number };
    '24h': { avgIPS: number; count: number };
  };
  outcomes: {
    POSITIVE_MOVE: number;
    NEGATIVE_MOVE: number;
    NO_EFFECT: number;
    VOLATILITY_SPIKE: number;
  };
  lastUpdated: number;
}

/**
 * Aggregated IPS stats for an asset
 */
export interface AssetIPSStats {
  asset: string;
  totalEvents: number;
  avgIPS: number;
  topActors: Array<{
    actorId: string;
    avgIPS: number;
    eventCount: number;
  }>;
  lastUpdated: number;
}
