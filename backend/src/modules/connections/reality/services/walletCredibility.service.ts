/**
 * Wallet Credibility Service
 * 
 * PHASE E2: Wrapper around E3 Wallet Attribution
 * 
 * Mapping:
 * - HIGH → 0.9-1.0
 * - MEDIUM → 0.6-0.8
 * - LOW → 0.3-0.5
 * - UNKNOWN → 0.5
 */

import { Db } from 'mongodb';
import { WalletCredibility, WalletBadge } from '../contracts/reality.types.js';

let db: Db;

export function initWalletCredibility(database: Db) {
  db = database;
  console.log('[WalletCredibility] Service initialized');
}

const BADGE_SCORES: Record<WalletBadge, { min: number; max: number }> = {
  HIGH: { min: 0.9, max: 1.0 },
  MEDIUM: { min: 0.6, max: 0.8 },
  LOW: { min: 0.3, max: 0.5 },
  UNKNOWN: { min: 0.5, max: 0.5 },
};

/**
 * Get wallet credibility for an actor
 */
export async function getWalletCredibility(actorId: string): Promise<WalletCredibility> {
  try {
    // Check wallet attribution store
    const attribution = await db.collection('connections_wallet_attributions').findOne({
      actorId,
    });
    
    if (!attribution) {
      return {
        badge: 'UNKNOWN',
        score_0_1: 0.5,
        linkedWalletsCount: 0,
        evidence: ['No wallet attribution found'],
      };
    }
    
    // Calculate badge from attribution data
    const wallets = attribution.wallets || [];
    const linkedCount = wallets.length;
    const avgCredibility = attribution.credibility_score_0_1 || 0.5;
    
    // Determine badge
    let badge: WalletBadge;
    if (avgCredibility >= 0.85) {
      badge = 'HIGH';
    } else if (avgCredibility >= 0.6) {
      badge = 'MEDIUM';
    } else if (avgCredibility >= 0.3) {
      badge = 'LOW';
    } else {
      badge = 'UNKNOWN';
    }
    
    // Adjust score within badge range
    const { min, max } = BADGE_SCORES[badge];
    const score = min + (max - min) * Math.min(1, linkedCount / 5);
    
    const evidence: string[] = [];
    if (linkedCount > 0) {
      evidence.push(`${linkedCount} wallet(s) linked`);
    }
    if (attribution.verified) {
      evidence.push('Verified attribution');
    }
    
    return {
      badge,
      score_0_1: Math.round(score * 100) / 100,
      linkedWalletsCount: linkedCount,
      evidence,
    };
  } catch (err) {
    console.log('[WalletCredibility] Error:', err);
    return {
      badge: 'UNKNOWN',
      score_0_1: 0.5,
      linkedWalletsCount: 0,
    };
  }
}

/**
 * Batch get credibility for multiple actors
 */
export async function batchGetCredibility(
  actorIds: string[]
): Promise<Map<string, WalletCredibility>> {
  const results = new Map<string, WalletCredibility>();
  
  for (const actorId of actorIds) {
    const cred = await getWalletCredibility(actorId);
    results.set(actorId, cred);
  }
  
  return results;
}

/**
 * Get credibility score for badge (static helper)
 */
export function getBadgeScore(badge: WalletBadge): number {
  const { min, max } = BADGE_SCORES[badge];
  return (min + max) / 2;
}
