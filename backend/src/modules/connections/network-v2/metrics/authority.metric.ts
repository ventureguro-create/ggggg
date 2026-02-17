/**
 * Authority v3 Calculator
 * 
 * Authority = 0.45×SeedAuthority + 0.35×OnchainAuthority + 0.20×MediaAuthority
 * 
 * This is the "real-world" authority, independent of Twitter.
 */

import type { AuthorityV3 } from '../network-v2-plus.types.js';
import { AUTHORITY_WEIGHTS, SEED_TIERS } from '../network-v2-plus.types.js';

export interface AuthorityV3Input {
  // Seed Authority components
  baseTier: keyof typeof SEED_TIERS;  // TIER_0, TIER_1, etc
  trustFactor: number;                 // 0-1 (verification level)
  
  // Onchain Authority components
  tvl?: number;                // Total Value Locked (or invested capital)
  networkPosition?: number;    // PageRank from onchain graph (0-1)
  activityQuality?: number;    // SuccessfulActions / TotalActions (0-1)
  
  // Media Authority components
  reach?: number;              // views + impressions
  resonance?: number;          // (quotes + reposts) / views (0-1)
  mediaCredibility?: number;   // 0-1 (primary source = 1.0, echo = 0.2)
}

/**
 * Calculate Seed Authority
 * SeedAuthority = BaseTier × TrustFactor
 */
export function calculateSeedAuthority(
  baseTier: keyof typeof SEED_TIERS,
  trustFactor: number
): number {
  const tierValue = SEED_TIERS[baseTier] ?? 0;
  return tierValue * trustFactor;
}

/**
 * Calculate Onchain Authority
 * OnchainAuthority = 0.40×CapitalWeight + 0.35×NetworkPosition + 0.25×ActivityQuality
 */
export function calculateOnchainAuthority(
  tvl: number,
  networkPosition: number,
  activityQuality: number
): number {
  // Normalize TVL to 0-1 using log scale
  // $1B TVL = 1.0
  const capitalWeight = tvl > 0 ? Math.min(1, Math.log10(tvl) / 9) : 0;
  
  return (
    0.40 * capitalWeight +
    0.35 * networkPosition +
    0.25 * activityQuality
  );
}

/**
 * Calculate Media Authority
 * MediaAuthority = Reach × Resonance × Credibility
 */
export function calculateMediaAuthority(
  reach: number,
  resonance: number,
  credibility: number
): number {
  // Normalize reach using log scale
  // 10M reach = 1.0
  const normalizedReach = reach > 0 ? Math.min(1, Math.log10(reach) / 7) : 0;
  
  return normalizedReach * resonance * credibility;
}

/**
 * Calculate full Authority v3
 */
export function calculateAuthorityV3(input: AuthorityV3Input): AuthorityV3 {
  const seedAuthority = calculateSeedAuthority(
    input.baseTier,
    input.trustFactor
  );
  
  const onchainAuthority = calculateOnchainAuthority(
    input.tvl || 0,
    input.networkPosition || 0,
    input.activityQuality || 0.5
  );
  
  const mediaAuthority = calculateMediaAuthority(
    input.reach || 0,
    input.resonance || 0,
    input.mediaCredibility || 0.5
  );
  
  // Weighted sum
  let authority =
    AUTHORITY_WEIGHTS.seed * seedAuthority +
    AUTHORITY_WEIGHTS.onchain * onchainAuthority +
    AUTHORITY_WEIGHTS.media * mediaAuthority;
  
  // Anti-hype cap: Media can't make authority > real weight + 0.25
  const realWorldCap = Math.max(seedAuthority, onchainAuthority) + 0.25;
  if (authority > realWorldCap) {
    authority = realWorldCap;
  }
  
  return {
    seedAuthority,
    onchainAuthority,
    mediaAuthority,
    authority,
    details: {
      baseTier: SEED_TIERS[input.baseTier] ?? 0,
      trustFactor: input.trustFactor,
      capitalWeight: input.tvl ? Math.min(1, Math.log10(input.tvl) / 9) : 0,
      networkPosition: input.networkPosition || 0,
      activityQuality: input.activityQuality || 0.5,
      reach: input.reach || 0,
      resonance: input.resonance || 0,
      credibility: input.mediaCredibility || 0.5,
    },
  };
}

/**
 * Quick authority estimate from Backer entity
 */
export function estimateAuthorityFromBacker(
  seedAuthority: number,  // 0-100 from Backer
  confidence: number      // 0-1 from Backer
): number {
  // Convert to 0-1 scale
  const seed = (seedAuthority / 100) * confidence;
  
  // Assume minimal onchain/media for unknown
  return (
    AUTHORITY_WEIGHTS.seed * seed +
    AUTHORITY_WEIGHTS.onchain * 0.2 +
    AUTHORITY_WEIGHTS.media * 0.1
  );
}

/**
 * Determine seed tier from authority score
 */
export function determineSeedTier(authority: number): keyof typeof SEED_TIERS {
  if (authority >= 0.95) return 'TIER_0';
  if (authority >= 0.80) return 'TIER_1';
  if (authority >= 0.60) return 'TIER_2';
  if (authority >= 0.40) return 'TIER_3';
  return 'UNKNOWN';
}

console.log('[AuthorityV3] Calculator loaded');
