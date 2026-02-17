/**
 * БЛОК 14 — Asset Lifecycle State Service
 */

import { Db } from 'mongodb';
import { AssetLifecycleState, LifecyclePhase, ALSScores, ExchangeFeatures } from './asset-lifecycle.types.js';

const COLLECTION = 'asset_lifecycle_states';

export class AssetLifecycleService {
  constructor(private db: Db) {}

  /**
   * Calculate lifecycle scores based on exchange features
   */
  calculateScores(features: ExchangeFeatures): ALSScores {
    let accumulation = 0;
    let ignition = 0;
    let expansion = 0;
    let distribution = 0;

    // ACCUMULATION: flat price, vol↑, oi↑, funding~0, compressed vol
    if (Math.abs(features.priceSlope) < 0.02) accumulation += 0.3;
    if (features.volumeDelta > 0) accumulation += 0.2;
    if (features.oiDelta > 0) accumulation += 0.2;
    if (Math.abs(features.fundingRate) < 0.01) accumulation += 0.15;
    if (features.volatilityState === 'compressed') accumulation += 0.15;

    // IGNITION: price breaks, volume spikes, oi grows fast, short liqs
    if (features.priceSlope > 0.05) ignition += 0.25;
    if (features.volumeDelta > 0.5) ignition += 0.25;
    if (features.oiDelta > 0.3) ignition += 0.2;
    if (features.volatilityState === 'expanding') ignition += 0.15;
    if (features.liqBias === 'shorts') ignition += 0.15;

    // EXPANSION: price↑↑, vol↑↑, high funding, high breadth
    if (features.priceSlope > 0.1) expansion += 0.25;
    if (features.volumeDelta > 1.0) expansion += 0.2;
    if (features.fundingRate > 0.02) expansion += 0.2;
    if (features.participationBreadth > 0.7) expansion += 0.2;
    if (features.volatilityState === 'expanding') expansion += 0.15;

    // DISTRIBUTION: price stalls, vol↓, oi↓, extreme funding, long liqs
    if (Math.abs(features.priceSlope) < 0.02 && features.volumeDelta < 0) distribution += 0.25;
    if (features.oiDelta < 0) distribution += 0.2;
    if (features.fundingRate > 0.05 || features.fundingRate < -0.05) distribution += 0.2;
    if (features.liqBias === 'longs') distribution += 0.2;
    if (features.failedBreakouts > 2) distribution += 0.15;

    // Normalize
    const total = accumulation + ignition + expansion + distribution;
    if (total > 0) {
      accumulation /= total;
      ignition /= total;
      expansion /= total;
      distribution /= total;
    }

    return { accumulation, ignition, expansion, distribution };
  }

  determineState(scores: ALSScores): { state: LifecyclePhase; confidence: number } {
    const entries = Object.entries(scores) as [LifecyclePhase, number][];
    entries.sort((a, b) => b[1] - a[1]);
    return {
      state: entries[0][0].toUpperCase() as LifecyclePhase,
      confidence: entries[0][1],
    };
  }

  async updateAssetState(
    asset: string,
    features: ExchangeFeatures,
    window: '1h' | '4h' | '24h' = '4h'
  ): Promise<AssetLifecycleState> {
    const scores = this.calculateScores(features);
    const { state, confidence } = this.determineState(scores);

    const als: AssetLifecycleState = {
      asset,
      state,
      confidence,
      scores,
      window,
      timestamp: new Date(),
      createdAt: new Date(),
    };

    await this.db.collection(COLLECTION).updateOne(
      { asset, window },
      { $set: als },
      { upsert: true }
    );

    return als;
  }

  async getAssetState(asset: string): Promise<AssetLifecycleState | null> {
    return this.db.collection<AssetLifecycleState>(COLLECTION).findOne(
      { asset },
      { sort: { timestamp: -1 } }
    );
  }

  async getAllStates(filter?: { state?: LifecyclePhase }): Promise<AssetLifecycleState[]> {
    const query: any = {};
    if (filter?.state) query.state = filter.state;

    return this.db.collection<AssetLifecycleState>(COLLECTION)
      .find(query)
      .sort({ confidence: -1 })
      .toArray();
  }

  async getByPhase(phase: LifecyclePhase): Promise<AssetLifecycleState[]> {
    return this.db.collection<AssetLifecycleState>(COLLECTION)
      .find({ state: phase })
      .sort({ confidence: -1 })
      .toArray();
  }
}
