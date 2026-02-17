/**
 * Backer Inheritance Engine
 * 
 * Calculates inherited authority for Twitter accounts
 * based on their bindings to Backers.
 * 
 * CRITICAL PRINCIPLE:
 * Twitter NEVER creates authority - only inherits and potentially reduces it.
 */

import * as BackerStore from './backer.store.js';
import type { 
  InheritedAuthority, 
  BackerBinding,
  BackerEntity,
  AUTHORITY_INHERITANCE_CAP,
} from './backer.types.js';

// Cap: Max inheritance = 85% of backer's authority
const INHERITANCE_CAP = 0.85;

// Relation weights - how much authority flows through each relation type
const RELATION_WEIGHTS: Record<string, number> = {
  OWNER: 1.0,       // Full authority
  BUILDER: 0.8,     // 80%
  INVESTOR: 0.6,    // 60%
  AFFILIATED: 0.4,  // 40%
  ECOSYSTEM: 0.3,   // 30%
};

// ============================================================
// MAIN RESOLVER
// ============================================================

export async function resolveInheritedAuthority(
  twitterId: string
): Promise<InheritedAuthority> {
  // Get all bindings for this Twitter account
  const bindings = await BackerStore.getBindingsByTarget('TWITTER', twitterId);
  
  if (bindings.length === 0) {
    return {
      twitterId,
      baseAuthority: 0,
      inheritedAuthority: 0,
      finalAuthority: 0,
      sources: [],
      capApplied: false,
    };
  }
  
  // Resolve each binding's contribution
  const sources: InheritedAuthority['sources'] = [];
  let totalInherited = 0;
  
  for (const binding of bindings) {
    const backer = await BackerStore.getBackerById(binding.backerId);
    if (!backer || backer.status !== 'ACTIVE') continue;
    
    // Calculate contribution
    const contribution = calculateContribution(backer, binding);
    
    sources.push({
      backerId: backer.id,
      backerName: backer.name,
      contribution,
      relation: binding.relation,
    });
    
    totalInherited += contribution;
  }
  
  // Apply cap (max 100)
  const cappedAuthority = Math.min(totalInherited, 100);
  const capApplied = totalInherited > 100;
  
  return {
    twitterId,
    baseAuthority: 0, // Base is computed elsewhere
    inheritedAuthority: cappedAuthority,
    finalAuthority: cappedAuthority,
    sources,
    capApplied,
    cappedFrom: capApplied ? totalInherited : undefined,
  };
}

// ============================================================
// BATCH RESOLUTION
// ============================================================

export async function resolveInheritedAuthorityBatch(
  twitterIds: string[]
): Promise<Map<string, InheritedAuthority>> {
  const results = new Map<string, InheritedAuthority>();
  
  // Could optimize with aggregation, but keeping simple for now
  for (const twitterId of twitterIds) {
    const result = await resolveInheritedAuthority(twitterId);
    results.set(twitterId, result);
  }
  
  return results;
}

// ============================================================
// CONTRIBUTION CALCULATION
// ============================================================

function calculateContribution(
  backer: BackerEntity,
  binding: BackerBinding
): number {
  // Base = backer's seed authority
  const baseAuthority = backer.seedAuthority;
  
  // Apply confidence
  const withConfidence = baseAuthority * backer.confidence;
  
  // Apply relation weight
  const relationWeight = RELATION_WEIGHTS[binding.relation] || 0.3;
  const withRelation = withConfidence * relationWeight;
  
  // Apply binding weight
  const withBinding = withRelation * binding.weight;
  
  // Apply inheritance cap
  const capped = withBinding * INHERITANCE_CAP;
  
  return Math.round(capped * 100) / 100;
}

// ============================================================
// NETWORK ANCHOR CONVERSION
// ============================================================

import type { NetworkAnchor } from './backer.types.js';

export async function getNetworkAnchorsForTwitter(
  twitterId: string
): Promise<NetworkAnchor[]> {
  const bindings = await BackerStore.getBindingsByTarget('TWITTER', twitterId);
  const anchors: NetworkAnchor[] = [];
  
  for (const binding of bindings) {
    const backer = await BackerStore.getBackerById(binding.backerId);
    if (!backer || backer.status !== 'ACTIVE') continue;
    
    anchors.push({
      id: backer.id,
      type: 'BACKER',
      name: backer.name,
      weight: (backer.seedAuthority / 100) * backer.confidence,
      confidence: backer.confidence,
      sourceType: 'BACKER',
      sourceId: backer.id,
    });
  }
  
  return anchors;
}

// ============================================================
// QUERY: FIND TWITTER ACCOUNTS BY BACKER
// ============================================================

export async function getTwitterAccountsWithBacker(
  backerId: string
): Promise<string[]> {
  const bindings = await BackerStore.getBindingsByBacker(backerId);
  return bindings
    .filter(b => b.targetType === 'TWITTER')
    .map(b => b.targetId);
}

// ============================================================
// QUERY: CHECK IF ACCOUNT HAS BACKER
// ============================================================

export async function hasBacker(twitterId: string): Promise<boolean> {
  const bindings = await BackerStore.getBindingsByTarget('TWITTER', twitterId);
  return bindings.length > 0;
}

// ============================================================
// EXPORT AGGREGATED STATS
// ============================================================

export async function getInheritanceStats(): Promise<{
  accountsWithBackers: number;
  avgInheritedAuthority: number;
  topBackerContributors: { backerId: string; name: string; bindings: number }[];
}> {
  // This would require aggregation on bindings
  // Simplified for now
  const bindingStats = await BackerStore.getBindingStats();
  
  return {
    accountsWithBackers: bindingStats.total,
    avgInheritedAuthority: 0, // Would need to compute
    topBackerContributors: [], // Would need aggregation
  };
}

console.log('[BackerInheritanceEngine] Initialized');
