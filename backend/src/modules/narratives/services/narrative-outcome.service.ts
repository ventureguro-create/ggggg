/**
 * БЛОК 18 — Narrative Outcome Tracker + Predictiveness Engine
 */

import { Db } from 'mongodb';
import { NarrativeOutcome, NarrativeState } from '../models/narrative.types.js';

const OUTCOMES = 'narrative_outcomes';
const EVENTS = 'narrative_events';
const NARRATIVES = 'narratives';

export interface NarrativeEvent {
  _id?: any;
  narrativeKey: string;
  symbol: string;
  eventAt: Date;
  nms: number;
  socialWeight: number;
  createdAt: Date;
}

export interface NarrativeStats {
  narrative: string;
  state: NarrativeState;
  nps: number; // Narrative Predictiveness Score
  tpRate: number;
  avgReturn: number;
  events: number;
}

export class NarrativeOutcomeService {
  constructor(private db: Db) {}

  /**
   * Record a narrative event (when NMS crosses threshold)
   */
  async recordEvent(event: Omit<NarrativeEvent, '_id' | 'createdAt'>): Promise<void> {
    await this.db.collection(EVENTS).insertOne({
      ...event,
      createdAt: new Date(),
    });
  }

  /**
   * Record outcome after horizon (1h/4h/24h)
   */
  async recordOutcome(outcome: Omit<NarrativeOutcome, '_id' | 'createdAt'>): Promise<void> {
    await this.db.collection(OUTCOMES).insertOne({
      ...outcome,
      createdAt: new Date(),
    });
  }

  /**
   * Get outcomes for a narrative
   */
  async getOutcomes(narrativeKey: string, limit = 50): Promise<NarrativeOutcome[]> {
    return this.db.collection<NarrativeOutcome>(OUTCOMES)
      .find({ narrativeKey })
      .sort({ eventAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Calculate Narrative Predictiveness Score (NPS)
   * NPS = (TP_rate × avg_return) × consistency × sample_confidence
   */
  async calculateNPS(narrativeKey: string): Promise<NarrativeStats | null> {
    const outcomes = await this.db.collection<NarrativeOutcome>(OUTCOMES)
      .find({ narrativeKey })
      .toArray();

    if (outcomes.length === 0) return null;

    const narrative = await this.db.collection(NARRATIVES).findOne({ key: narrativeKey });
    if (!narrative) return null;

    const tp = outcomes.filter(o => o.label === 'TP');
    const tpRate = tp.length / outcomes.length;
    const avgReturn = tp.length > 0 
      ? tp.reduce((sum, o) => sum + o.retPct, 0) / tp.length 
      : 0;

    // Consistency (inverse of std deviation)
    const returns = outcomes.map(o => o.retPct);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const consistency = 1 / (1 + stdDev);

    // Sample confidence
    const sampleConfidence = Math.min(1, outcomes.length / 30);

    const nps = tpRate * avgReturn * consistency * sampleConfidence;

    return {
      narrative: narrativeKey,
      state: narrative.state as NarrativeState,
      nps: Math.max(0, Math.min(1, nps * 10)), // normalize
      tpRate,
      avgReturn,
      events: outcomes.length,
    };
  }

  /**
   * Get top predictive narratives
   */
  async getTopPredictiveNarratives(limit = 10): Promise<NarrativeStats[]> {
    const narratives = await this.db.collection(NARRATIVES).find({}).toArray();
    const stats: NarrativeStats[] = [];

    for (const n of narratives) {
      const nps = await this.calculateNPS(n.key as string);
      if (nps && nps.events >= 5) {
        stats.push(nps);
      }
    }

    stats.sort((a, b) => b.nps - a.nps);
    return stats.slice(0, limit);
  }

  /**
   * Update narrative state based on outcomes
   */
  async updateNarrativeState(narrativeKey: string): Promise<NarrativeState | null> {
    const stats = await this.calculateNPS(narrativeKey);
    if (!stats) return null;

    let newState: NarrativeState;
    if (stats.tpRate >= 0.6 && stats.avgReturn > 0.05) {
      newState = 'IGNITION'; // CONFIRMED -> keep active
    } else if (stats.nps < 0.3 && stats.events >= 10) {
      newState = 'DECAY'; // OVERHEATED -> dying
    } else {
      // Keep current state
      return stats.state;
    }

    await this.db.collection(NARRATIVES).updateOne(
      { key: narrativeKey },
      { $set: { state: newState, updatedAt: new Date() } }
    );

    return newState;
  }
}
