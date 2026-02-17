/**
 * БЛОК 15 — Cluster Lifecycle State Service
 */

import { Db } from 'mongodb';
import { ClusterLifecycleState, ClusterAssetWeight } from './cluster-lifecycle.types.js';
import { LifecyclePhase, ALSScores } from '../asset-lifecycle/asset-lifecycle.types.js';

const COLLECTION = 'cluster_lifecycle_states';

export class ClusterLifecycleService {
  constructor(private db: Db) {}

  /**
   * Aggregate ALS -> CLS with weighted average
   */
  aggregateToCluster(assets: ClusterAssetWeight[]): { scores: ALSScores; state: LifecyclePhase; confidence: number } {
    if (assets.length === 0) {
      return {
        scores: { accumulation: 0.25, ignition: 0.25, expansion: 0.25, distribution: 0.25 },
        state: 'ACCUMULATION',
        confidence: 0,
      };
    }

    const totalWeight = assets.reduce((sum, a) => sum + a.weight, 0);
    
    const scores: ALSScores = {
      accumulation: 0,
      ignition: 0,
      expansion: 0,
      distribution: 0,
    };

    for (const asset of assets) {
      const w = asset.weight / totalWeight;
      scores.accumulation += asset.als.accumulation * w;
      scores.ignition += asset.als.ignition * w;
      scores.expansion += asset.als.expansion * w;
      scores.distribution += asset.als.distribution * w;
    }

    // Determine state
    const entries = Object.entries(scores) as [string, number][];
    entries.sort((a, b) => b[1] - a[1]);
    const state = entries[0][0].toUpperCase() as LifecyclePhase;
    const confidence = entries[0][1];

    return { scores, state, confidence };
  }

  async updateClusterState(
    cluster: string,
    assets: ClusterAssetWeight[],
    window: '1h' | '4h' | '24h' = '4h'
  ): Promise<ClusterLifecycleState> {
    const { scores, state, confidence } = this.aggregateToCluster(assets);

    const cls: ClusterLifecycleState = {
      cluster,
      state,
      confidence,
      scores,
      assetCount: assets.length,
      window,
      timestamp: new Date(),
      createdAt: new Date(),
    };

    await this.db.collection(COLLECTION).updateOne(
      { cluster, window },
      { $set: cls },
      { upsert: true }
    );

    return cls;
  }

  async getClusterState(cluster: string): Promise<ClusterLifecycleState | null> {
    return this.db.collection<ClusterLifecycleState>(COLLECTION).findOne(
      { cluster },
      { sort: { timestamp: -1 } }
    );
  }

  async getAllClusterStates(): Promise<ClusterLifecycleState[]> {
    return this.db.collection<ClusterLifecycleState>(COLLECTION)
      .find({})
      .sort({ confidence: -1 })
      .toArray();
  }

  async getClustersByPhase(phase: LifecyclePhase): Promise<ClusterLifecycleState[]> {
    return this.db.collection<ClusterLifecycleState>(COLLECTION)
      .find({ state: phase })
      .sort({ confidence: -1 })
      .toArray();
  }
}
