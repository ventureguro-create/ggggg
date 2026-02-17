/**
 * БЛОК 16-17 — Narrative Service
 */

import { Db } from 'mongodb';
import { Narrative, NarrativeState, NarrativeBinding, NarrativeAtom } from '../models/narrative.types.js';

const NARRATIVES = 'narratives';
const BINDINGS = 'narrative_bindings';
const ATOMS = 'narrative_atoms';

export class NarrativeService {
  constructor(private db: Db) {}

  /**
   * Calculate Narrative Momentum Score (NMS)
   * NMS = velocity * influencer_quality * cluster_diversity * novelty_factor
   */
  calculateNMS(
    velocity: number,
    influencerWeight: number,
    clusterSpread: number,
    noveltyFactor: number
  ): number {
    const v = Math.max(0, Math.min(1, velocity / 100));
    const i = Math.max(0, Math.min(1, influencerWeight));
    const c = Math.max(0, Math.min(1, clusterSpread));
    const n = Math.max(0, Math.min(1, noveltyFactor));
    return v * 0.3 + i * 0.3 + c * 0.2 + n * 0.2;
  }

  classifyState(nms: number, age: number): NarrativeState {
    // age in hours
    if (nms < 0.2) return 'SEEDING';
    if (nms >= 0.8 && age < 24) return 'IGNITION';
    if (nms >= 0.6 && age < 72) return 'EXPANSION';
    if (nms >= 0.4 && age >= 72) return 'SATURATION';
    return 'DECAY';
  }

  async upsertNarrative(data: Omit<Narrative, '_id' | 'createdAt'>): Promise<Narrative> {
    const narrative: Narrative = {
      ...data,
      timestamp: new Date(),
      createdAt: new Date(),
    };

    await this.db.collection(NARRATIVES).updateOne(
      { key: data.key },
      { $set: narrative, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    return narrative;
  }

  async getTopNarratives(states: NarrativeState[] = ['SEEDING', 'IGNITION'], limit = 15): Promise<Narrative[]> {
    return this.db.collection<Narrative>(NARRATIVES)
      .find({ state: { $in: states } })
      .sort({ nms: -1 })
      .limit(limit)
      .toArray();
  }

  async getNarrative(key: string): Promise<Narrative | null> {
    return this.db.collection<Narrative>(NARRATIVES).findOne({ key });
  }

  async getAllNarratives(): Promise<Narrative[]> {
    return this.db.collection<Narrative>(NARRATIVES)
      .find({})
      .sort({ nms: -1 })
      .toArray();
  }

  // Bindings
  async addBinding(binding: Omit<NarrativeBinding, '_id'>): Promise<void> {
    await this.db.collection(BINDINGS).updateOne(
      { narrativeKey: binding.narrativeKey, symbol: binding.symbol },
      { $set: { ...binding, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async getBindingsForNarrative(narrativeKey: string): Promise<NarrativeBinding[]> {
    return this.db.collection<NarrativeBinding>(BINDINGS)
      .find({ narrativeKey })
      .sort({ weight: -1 })
      .toArray();
  }

  async getBindingsForSymbol(symbol: string): Promise<NarrativeBinding[]> {
    return this.db.collection<NarrativeBinding>(BINDINGS)
      .find({ symbol })
      .sort({ weight: -1 })
      .toArray();
  }

  // Atoms
  async upsertAtom(atom: Omit<NarrativeAtom, '_id'>): Promise<void> {
    await this.db.collection(ATOMS).updateOne(
      { keyword: atom.keyword },
      { $set: { ...atom, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async getTrendingAtoms(limit = 20): Promise<NarrativeAtom[]> {
    return this.db.collection<NarrativeAtom>(ATOMS)
      .find({})
      .sort({ weightedAttention: -1 })
      .limit(limit)
      .toArray();
  }
}
