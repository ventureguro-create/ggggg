/**
 * БЛОК 19 — Influencer Narrative Service
 */

import { Db } from 'mongodb';
import { 
  InfluencerNarrativeStats, 
  InfluencerRole, 
  InfluencerNarrativeContribution,
  InfluencerNarrativeEdge
} from './influencer-narrative.types.js';

const STATS = 'influencer_narrative_stats';
const CONTRIBUTIONS = 'influencer_narrative_contributions';

export class InfluencerNarrativeService {
  constructor(private db: Db) {}

  /**
   * Record contribution (when influencer mentions narrative before event)
   */
  async recordContribution(
    influencerId: string,
    narrativeKey: string,
    weight: number
  ): Promise<void> {
    await this.db.collection(CONTRIBUTIONS).insertOne({
      influencerId,
      narrativeKey,
      weight,
      timestamp: new Date(),
    });
  }

  /**
   * Calculate Influencer Narrative Score (INS)
   * INS = Σ(EffectiveInfluence × avg_return) × consistency × sample_confidence
   */
  async calculateINS(influencerId: string, narrativeKey: string): Promise<number> {
    const stats = await this.db.collection<InfluencerNarrativeStats>(STATS)
      .findOne({ influencerId, narrativeKey });

    if (!stats || stats.eventsTriggered < 3) return 0;

    const tpRate = stats.tpCount / stats.eventsTriggered;
    const sampleConfidence = Math.min(1, stats.eventsTriggered / 20);
    
    return tpRate * (stats.avgReturn + 1) * sampleConfidence;
  }

  /**
   * Classify influencer role based on stats
   */
  classifyRole(stats: InfluencerNarrativeStats): InfluencerRole {
    if (stats.insScore >= 0.7) return 'DRIVER';
    if (stats.insScore >= 0.4) return 'AMPLIFIER';
    return 'NOISE';
  }

  /**
   * Update stats after outcome
   */
  async updateStats(
    influencerId: string,
    narrativeKey: string,
    isTP: boolean,
    returnPct: number
  ): Promise<InfluencerNarrativeStats> {
    const existing = await this.db.collection<InfluencerNarrativeStats>(STATS)
      .findOne({ influencerId, narrativeKey });

    const stats: InfluencerNarrativeStats = existing || {
      influencerId,
      narrativeKey,
      eventsTriggered: 0,
      tpCount: 0,
      fpCount: 0,
      avgReturn: 0,
      insScore: 0,
      role: 'NOISE',
      updatedAt: new Date(),
    };

    stats.eventsTriggered++;
    if (isTP) {
      stats.tpCount++;
      // Update running average
      stats.avgReturn = (stats.avgReturn * (stats.tpCount - 1) + returnPct) / stats.tpCount;
    } else {
      stats.fpCount++;
    }

    stats.insScore = await this.calculateINS(influencerId, narrativeKey);
    stats.role = this.classifyRole(stats);
    stats.updatedAt = new Date();

    await this.db.collection(STATS).updateOne(
      { influencerId, narrativeKey },
      { $set: stats },
      { upsert: true }
    );

    return stats;
  }

  /**
   * Get top drivers for a narrative
   */
  async getTopDrivers(narrativeKey: string, limit = 10): Promise<InfluencerNarrativeStats[]> {
    return this.db.collection<InfluencerNarrativeStats>(STATS)
      .find({ narrativeKey, role: { $in: ['DRIVER', 'AMPLIFIER'] } })
      .sort({ insScore: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get narratives for influencer
   */
  async getNarrativesForInfluencer(influencerId: string): Promise<InfluencerNarrativeStats[]> {
    return this.db.collection<InfluencerNarrativeStats>(STATS)
      .find({ influencerId })
      .sort({ insScore: -1 })
      .toArray();
  }

  /**
   * Build graph edges for visualization
   */
  async buildGraph(narrativeKeys?: string[]): Promise<InfluencerNarrativeEdge[]> {
    const query: any = {};
    if (narrativeKeys) {
      query.narrativeKey = { $in: narrativeKeys };
    }

    const allStats = await this.db.collection<InfluencerNarrativeStats>(STATS)
      .find(query)
      .toArray();

    return allStats.map(s => ({
      from: s.influencerId,
      to: s.narrativeKey,
      type: s.role === 'DRIVER' ? 'initiates' as const : 
            s.role === 'AMPLIFIER' ? 'amplifies' as const : 'late_noise' as const,
      weight: s.insScore,
      tpFpRatio: s.eventsTriggered > 0 ? s.tpCount / s.eventsTriggered : 0,
      avgReturn: s.avgReturn,
    }));
  }
}
