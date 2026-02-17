/**
 * Reality Gate Types
 * 
 * E2: On-chain × Twitter → Alerts filtering
 * 
 * KEY PRINCIPLE:
 * Twitter → инициатор
 * On-chain → судья  
 * Alerts → только после вердикта
 */

import { RealityVerdict } from '../reality/contracts/reality-ledger.types.js';

// Gate decision
export type GateDecision = 'SEND' | 'SEND_HIGH' | 'SEND_LOW' | 'SUPPRESS' | 'BLOCK';

// Input from Twitter side
export type TwitterEventInput = {
  eventId: string;
  actorId: string;
  asset?: string;
  twitterScore_0_1000?: number;
  networkScore_0_1?: number;
  eventType: 'BREAKOUT' | 'EARLY_SIGNAL' | 'SMART_NO_NAME' | 'VC_MENTION' | 'WHALE_ALERT' | 'GENERIC';
  occurredAt: string;
  meta?: {
    tweetId?: string;
    handle?: string;
  };
};

// Reality Gate result
export type RealityGateResult = {
  eventId: string;
  decision: GateDecision;
  realityScore_0_1: number;
  
  onchain: {
    verdict: RealityVerdict;
    confidence_0_1: number;
    flow_score?: number;
    exchange_pressure?: number;
  };
  
  trustAdjustment: {
    actorId: string;
    previousTrust_0_1: number;
    newTrust_0_1: number;
    reason: string;
  };
  
  alert?: {
    shouldSend: boolean;
    priority: 'HIGH' | 'NORMAL' | 'LOW';
    suppressReason?: string;
    warningBadge?: string;
  };
  
  evaluatedAt: string;
};

// Gate policy configuration
export type RealityGatePolicy = {
  // When to require on-chain confirmation
  requireConfirmFor: ('BREAKOUT' | 'EARLY_SIGNAL' | 'SMART_NO_NAME' | 'VC_MENTION' | 'WHALE_ALERT' | 'GENERIC')[];
  
  // Thresholds
  thresholds: {
    blockBelow_0_1: number;      // default 0.3 - block if reality score below
    downgradeBelow_0_1: number;  // default 0.5 - downgrade if below
    boostAbove_0_1: number;      // default 0.8 - boost if above
  };
  
  // Trust adjustments
  trustMultipliers: {
    onConfirmed: number;      // default 1.1
    onContradicted: number;   // default 0.5
    onNoData: number;         // default 0.95
  };
  
  // Behavior for NO_DATA
  noDataBehavior: 'SEND_LOW' | 'SUPPRESS' | 'SEND';
  
  // Kill switch
  enabled: boolean;
  bypassForHighAuthority: boolean;  // actors with authority > 0.9 bypass
};

export const DEFAULT_GATE_POLICY: RealityGatePolicy = {
  requireConfirmFor: ['BREAKOUT', 'EARLY_SIGNAL', 'WHALE_ALERT'],
  thresholds: {
    blockBelow_0_1: 0.3,
    downgradeBelow_0_1: 0.5,
    boostAbove_0_1: 0.8,
  },
  trustMultipliers: {
    onConfirmed: 1.1,
    onContradicted: 0.5,
    onNoData: 0.95,
  },
  noDataBehavior: 'SEND_LOW',
  enabled: true,
  bypassForHighAuthority: false,
};
