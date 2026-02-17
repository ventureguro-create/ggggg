/**
 * Influence Adjuster Service
 * 
 * PHASE C: Adjusts influence scores based on reality trust.
 */

import { ActorTrustService } from './actor-trust.service.js';
import { InfluenceAdjustment } from '../contracts/influence-adjustment.types.js';

export class InfluenceAdjusterService {
  constructor(private readonly trust: ActorTrustService) {}

  async adjust(input: {
    actorId: string;
    baseInfluenceScore_0_1000: number;
  }): Promise<InfluenceAdjustment> {
    const { trustMultiplier_0_1, reason, stats } =
      await this.trust.computeTrustMultiplier(input.actorId);

    const adjusted = Math.round(input.baseInfluenceScore_0_1000 * trustMultiplier_0_1);

    return {
      actorId: input.actorId,
      baseInfluenceScore_0_1000: input.baseInfluenceScore_0_1000,
      trustMultiplier_0_1,
      adjustedInfluenceScore_0_1000: adjusted,
      reason,
      stats,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  async batchAdjust(inputs: Array<{ actorId: string; baseInfluenceScore_0_1000: number }>): Promise<InfluenceAdjustment[]> {
    return Promise.all(inputs.map(input => this.adjust(input)));
  }
}
