/**
 * Reality Ledger Types
 * 
 * PHASE B: Stores the truth about Twitter events vs On-chain reality.
 */

import { OnchainSnapshot } from '../../adapters/onchain/contracts/onchain.types.js';

export type RealityVerdict = 'CONFIRMED' | 'CONTRADICTED' | 'NO_DATA';

export type RealityLedgerEntry = {
  _id?: string;
  eventId: string;

  asset?: string;
  actorId?: string;

  occurredAt: string;
  evaluatedAt: string;

  onchain: {
    verdict: RealityVerdict;
    confidence_0_1: number;
    snapshots: OnchainSnapshot[];
  };

  windows?: {
    t0?: RealityVerdict;
    t4h?: RealityVerdict;
    t24h?: RealityVerdict;
  };

  final: {
    trust_multiplier_0_1: number; // how this affects signal trust
    blocked: boolean;
    reason?: string;
  };
};
