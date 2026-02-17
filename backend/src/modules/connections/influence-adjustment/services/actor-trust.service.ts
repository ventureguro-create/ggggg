/**
 * Actor Trust Service
 * 
 * Computes trust multiplier based on historical on-chain verdicts.
 */

import { InfluenceHistoryStore } from '../storage/influence-history.store.js';
import { InfluencePenaltyReason } from '../contracts/influence-adjustment.types.js';

export class ActorTrustService {
  constructor(private readonly history: InfluenceHistoryStore) {}

  async computeTrustMultiplier(actorId: string): Promise<{
    trustMultiplier_0_1: number;
    reason: InfluencePenaltyReason;
    stats: { total: number; confirmed: number; contradicted: number; noData: number };
  }> {
    const stats = await this.history.getStats(actorId);

    // Not enough data to make a judgment
    if (stats.total < 3) {
      return { 
        trustMultiplier_0_1: 1, 
        reason: 'INSUFFICIENT_DATA',
        stats,
      };
    }

    const contradictionRate = stats.contradicted / stats.total;
    const confirmationRate = stats.confirmed / stats.total;

    // Significant contradictions - heavy penalty
    if (stats.contradicted >= 3 && contradictionRate > 0.3) {
      return { 
        trustMultiplier_0_1: Math.max(0.3, 0.7 - contradictionRate * 0.5), 
        reason: 'ONCHAIN_CONTRADICTED',
        stats,
      };
    }

    // Consistent confirmations - boost
    if (stats.confirmed >= 5 && contradictionRate < 0.1) {
      return { 
        trustMultiplier_0_1: Math.min(1.3, 1 + confirmationRate * 0.2), 
        reason: 'CONSISTENTLY_CONFIRMED',
        stats,
      };
    }

    // Mixed or mostly NO_DATA - slight penalty
    if (stats.noData / stats.total > 0.5) {
      return { 
        trustMultiplier_0_1: 0.85, 
        reason: 'REPEATED_NO_CONFIRMATION',
        stats,
      };
    }

    // Clean record
    return { 
      trustMultiplier_0_1: 1, 
      reason: 'CLEAN_RECORD',
      stats,
    };
  }
}
