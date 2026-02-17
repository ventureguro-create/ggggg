/**
 * БЛОК 20 — Alpha Surfaces Service
 */

import { Db } from 'mongodb';
import { 
  AlphaCandidate, 
  AlphaDirection, 
  AlphaSurfaceType,
  AlphaOutcome,
  AlphaSystemStats
} from './alpha.types.js';

const CANDIDATES = 'alpha_candidates';
const OUTCOMES = 'alpha_outcomes';

export class AlphaSurfacesService {
  constructor(private db: Db) {}

  /**
   * Calculate Alpha Score
   * alphaScore = 0.45 × marketScore + 0.30 × narrativeScore + 0.25 × influencerScore
   */
  calculateAlphaScore(
    marketScore: number,
    narrativeScore: number,
    influencerScore: number
  ): number {
    const m = Math.max(0, Math.min(1, marketScore));
    const n = Math.max(0, Math.min(1, narrativeScore));
    const i = Math.max(0, Math.min(1, influencerScore));
    return 0.45 * m + 0.30 * n + 0.25 * i;
  }

  /**
   * Determine surface type based on conditions
   */
  determineSurface(
    marketScore: number,
    narrativeScore: number,
    fundingExtreme: boolean,
    narrativeAge: number // hours
  ): AlphaSurfaceType {
    if (fundingExtreme && narrativeScore > 0.6) {
      return 'IMMEDIATE_MOMENTUM';
    }
    if (narrativeAge < 24 && narrativeScore > 0.5 && marketScore > 0.3) {
      return 'NARRATIVE_ROTATION';
    }
    if (narrativeScore > 0.7 && marketScore < 0.4) {
      return 'CROWDED_TRADE';
    }
    return 'NARRATIVE_ROTATION'; // default
  }

  /**
   * Generate explanations
   */
  generateExplanation(
    asset: string,
    marketScore: number,
    narrativeKey: string,
    narrativeScore: number,
    influencers: string[],
    funding?: number
  ): string[] {
    const explanations: string[] = [];

    if (funding !== undefined) {
      if (funding < -0.01) {
        explanations.push(`Funding ${(funding * 100).toFixed(2)}% (crowded shorts)`);
      } else if (funding > 0.01) {
        explanations.push(`Funding ${(funding * 100).toFixed(2)}% (crowded longs)`);
      }
    }

    if (narrativeScore > 0.6) {
      explanations.push(`Narrative ${narrativeKey} accelerating (${(narrativeScore * 100).toFixed(0)}%)`);
    }

    if (influencers.length > 0) {
      explanations.push(`Drivers: ${influencers.slice(0, 3).join(', ')}`);
    }

    if (marketScore > 0.5) {
      explanations.push(`Exchange signal (confidence ${(marketScore * 100).toFixed(0)}%)`);
    }

    return explanations;
  }

  /**
   * Create alpha candidate
   */
  async createCandidate(data: {
    asset: string;
    narrative: string;
    marketScore: number;
    narrativeScore: number;
    influencerScore: number;
    direction: AlphaDirection;
    horizon: '1h' | '4h' | '24h';
    explanation: string[];
    surface?: AlphaSurfaceType;
  }): Promise<AlphaCandidate | null> {
    // Skip if any score is below threshold
    if (data.marketScore < 0.3 || data.narrativeScore < 0.3 || data.influencerScore < 0.3) {
      return null;
    }

    const alphaScore = this.calculateAlphaScore(
      data.marketScore,
      data.narrativeScore,
      data.influencerScore
    );

    const candidate: AlphaCandidate = {
      asset: data.asset,
      narrative: data.narrative,
      marketScore: data.marketScore,
      narrativeScore: data.narrativeScore,
      influencerScore: data.influencerScore,
      alphaScore,
      direction: data.direction,
      horizon: data.horizon,
      surface: data.surface || 'NARRATIVE_ROTATION',
      explanation: data.explanation,
      timestamp: new Date(),
      createdAt: new Date(),
    };

    const result = await this.db.collection(CANDIDATES).insertOne(candidate);
    candidate._id = result.insertedId;

    return candidate;
  }

  /**
   * Get top alpha candidates
   */
  async getTopCandidates(
    surface?: AlphaSurfaceType,
    limit = 10
  ): Promise<AlphaCandidate[]> {
    const query: any = {
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    };
    if (surface) query.surface = surface;

    return this.db.collection<AlphaCandidate>(CANDIDATES)
      .find(query)
      .sort({ alphaScore: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Record outcome
   */
  async recordOutcome(outcome: Omit<AlphaOutcome, '_id' | 'createdAt'>): Promise<void> {
    await this.db.collection(OUTCOMES).insertOne({
      ...outcome,
      createdAt: new Date(),
    });
  }

  /**
   * Calculate system stats (BLOCK 21)
   */
  async getSystemStats(): Promise<AlphaSystemStats> {
    const outcomes = await this.db.collection<AlphaOutcome>(OUTCOMES)
      .find({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
      .toArray();

    if (outcomes.length === 0) {
      return {
        hitRate: 0,
        avgReturn: 0,
        falseAlphaRate: 0,
        narrativeEfficiency: 0,
        influencerROI: 0,
      };
    }

    const tp = outcomes.filter(o => o.result === 'TP');
    const fp = outcomes.filter(o => o.result === 'FP');

    const hitRate = tp.length / outcomes.length;
    const avgReturn = tp.length > 0 
      ? tp.reduce((sum, o) => sum + o.returnPct, 0) / tp.length 
      : 0;
    const falseAlphaRate = fp.length / outcomes.length;

    return {
      hitRate,
      avgReturn,
      falseAlphaRate,
      narrativeEfficiency: hitRate * avgReturn,
      influencerROI: avgReturn - falseAlphaRate * 0.1,
    };
  }
}
