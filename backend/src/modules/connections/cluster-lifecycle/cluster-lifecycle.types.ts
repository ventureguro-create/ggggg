/**
 * БЛОК 15 — Cluster Lifecycle State (CLS)
 * В какой фазе находится целый сегмент/тема
 */

import { LifecyclePhase, ALSScores } from '../asset-lifecycle/asset-lifecycle.types.js';

export interface ClusterLifecycleState {
  _id?: any;
  cluster: string; // e.g., "AI", "RWA", "Gaming"
  state: LifecyclePhase;
  confidence: number; // 0..1
  scores: ALSScores;
  assetCount: number;
  window: '1h' | '4h' | '24h';
  timestamp: Date;
  createdAt: Date;
}

export interface ClusterAssetWeight {
  asset: string;
  weight: number; // volume/OI share
  als: ALSScores;
}
