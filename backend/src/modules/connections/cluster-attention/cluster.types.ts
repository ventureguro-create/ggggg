/**
 * Cluster Attention System - Types
 * БЛОК 1-6: Types for influencer clusters and token attention
 */

// ============================
// БЛОК 1 - Cluster Extraction
// ============================

export interface InfluencerCluster {
  id: string;
  members: string[];  // actorIds / usernames
  metrics: ClusterMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterMetrics {
  size: number;
  cohesion: number;        // плотность связей (0..1)
  authority: number;       // Σ authority участников
  avgTrust: number;
}

export interface ClusterEdge {
  source: string;
  target: string;
  weight: number;  // edge_strength = w_follow + w_handshake + w_react
}

// ============================
// БЛОК 2 - Token Mention Index
// ============================

export interface TokenMention {
  token: string;
  actorId: string;
  clusterId?: string;
  timestamp: Date;
  weight: number;  // engagement_weight
  tweetId?: string;
  reach?: number;
  authority?: number;
}

export type TimeWindow = '1h' | '4h' | '24h';

export interface ClusterTokenAttention {
  clusterId: string;
  token: string;
  window: TimeWindow;
  mentions: number;
  uniqueActors: number;
  attentionScore: number;   // CTAS
  avgAuthority: number;
  cohesion: number;
  lastUpdated: Date;
}

// ============================
// БЛОК 3 - Coordinated Momentum
// ============================

export type MomentumLevel = 'BACKGROUND' | 'ATTENTION' | 'MOMENTUM' | 'PUMP_LIKE';

export interface ClusterTokenMomentum {
  clusterId: string;
  token: string;
  window: TimeWindow;
  velocity: number;        // attentionScore(1h) / attentionScore(4h)
  acceleration: number;    // (score_1h - score_4h) / score_4h
  momentumScore: number;   // CMS = acceleration × log(1 + uniqueActors) × cohesion
  uniqueActors: number;
  cohesion: number;
  level: MomentumLevel;
  lastUpdated: Date;
}

// ============================
// БЛОК 4 - Price Alignment
// ============================

export type AlignmentVerdict = 'CONFIRMED' | 'LAGGING' | 'NO_IMPACT';
export type Horizon = '15m' | '1h' | '4h';

export interface ClusterPriceAlignment {
  clusterId: string;
  token: string;
  momentumScore: number;
  priceReturn: number;
  volatility: number;
  impact: number;          // return / volatility
  alignmentScore: number;
  verdict: AlignmentVerdict;
  horizon: Horizon;
  timestamp: Date;
}

// ============================
// БЛОК 5 - Cluster Credibility
// ============================

export interface ClusterCredibility {
  clusterId: string;
  score: number;           // 0-1
  confirmationRate: number;
  avgImpact: number;
  consistency: number;
  totalEvents: number;
  lastConfirmedAt?: Date;
  updatedAt: Date;
}

// ============================
// БЛОК 6 - Token Momentum Score
// ============================

export interface TokenMomentum {
  symbol: string;
  score: number;           // 0-1
  rawMomentum: number;
  breadth: number;         // unique clusters / total active
  confirmationRatio: number;
  activeClusters: number;
  confirmedEvents: number;
  lastSpikeAt?: Date;
  updatedAt: Date;
}

// ============================
// Signal Classification
// ============================

export type ClusterSignalType = 'NOISE' | 'WEAK' | 'COORDINATED';

export interface TokenClusterSignal {
  token: string;
  clusterId: string;
  clusterSize: number;
  clusterAuthority: number;
  mentionIntensity: number;
  coordinationScore: number;
  signalType: ClusterSignalType;
  timestamp: Date;
}
