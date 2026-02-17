/**
 * Wallet Attribution Types
 * 
 * E3: Wallet → Actor (Backer/Account) mapping
 * 
 * KEY PRINCIPLE:
 * - Wallets are anonymous on-chain entities
 * - Actors are known entities (VCs, funds, influencers)
 * - Attribution connects them for trust validation
 */

export type WalletChain = 'ethereum' | 'solana' | 'bitcoin' | 'arbitrum' | 'optimism' | 'base' | 'polygon';

export type AttributionSource = 
  | 'MANUAL'           // Admin added
  | 'ARKHAM'           // From Arkham Intelligence
  | 'NANSEN'           // From Nansen
  | 'ONCHAIN_LABEL'    // On-chain label (ENS, etc)
  | 'SELF_REPORTED'    // Actor claimed ownership
  | 'INFERRED';        // ML/heuristic inferred

export type AttributionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

// Core wallet attribution
export type WalletAttribution = {
  _id?: string;
  walletAddress: string;
  chain: WalletChain;
  
  // Who owns this wallet
  actorId?: string;           // Twitter account ID
  backerId?: string;          // Backer registry ID
  actorLabel?: string;        // Human readable name
  
  // Attribution metadata
  source: AttributionSource;
  confidence: AttributionConfidence;
  confidenceScore_0_1: number;
  
  // Verification
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  
  // Activity tracking
  lastActivityAt?: string;
  totalTransactions?: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Notes
  notes?: string;
  tags?: string[];
};

// Wallet activity snapshot
export type WalletActivity = {
  walletAddress: string;
  chain: WalletChain;
  timestamp: string;
  
  // Activity metrics
  inflow_usd: number;
  outflow_usd: number;
  netFlow_usd: number;
  
  // Transaction details
  txCount: number;
  uniqueTokens: number;
  
  // Derived signals
  isAccumulating: boolean;
  isDistributing: boolean;
};

// Attribution request (for creating/updating)
export type CreateAttributionRequest = {
  walletAddress: string;
  chain: WalletChain;
  actorId?: string;
  backerId?: string;
  actorLabel: string;
  source: AttributionSource;
  confidence: AttributionConfidence;
  notes?: string;
  tags?: string[];
};

// Confidence score mapping
export const CONFIDENCE_SCORES: Record<AttributionConfidence, number> = {
  HIGH: 0.95,
  MEDIUM: 0.75,
  LOW: 0.5,
  UNVERIFIED: 0.25,
};
