/**
 * Seed данные для БЛОКОВ 13-21
 */

import { Db } from 'mongodb';

export async function seedBlocks13To21(db: Db): Promise<void> {
  console.log('[Seed] Seeding BLOCKS 13-21 data...');

  // === БЛОК 14: Asset Lifecycle States ===
  const assetLifecycles = [
    { asset: 'SOL', state: 'IGNITION', confidence: 0.71, scores: { accumulation: 0.18, ignition: 0.71, expansion: 0.08, distribution: 0.03 }, window: '4h' },
    { asset: 'FET', state: 'ACCUMULATION', confidence: 0.65, scores: { accumulation: 0.65, ignition: 0.25, expansion: 0.05, distribution: 0.05 }, window: '4h' },
    { asset: 'RNDR', state: 'IGNITION', confidence: 0.68, scores: { accumulation: 0.22, ignition: 0.68, expansion: 0.07, distribution: 0.03 }, window: '4h' },
    { asset: 'TAO', state: 'ACCUMULATION', confidence: 0.55, scores: { accumulation: 0.55, ignition: 0.30, expansion: 0.10, distribution: 0.05 }, window: '4h' },
    { asset: 'AGIX', state: 'EXPANSION', confidence: 0.58, scores: { accumulation: 0.15, ignition: 0.22, expansion: 0.58, distribution: 0.05 }, window: '4h' },
    { asset: 'ONDO', state: 'IGNITION', confidence: 0.72, scores: { accumulation: 0.18, ignition: 0.72, expansion: 0.07, distribution: 0.03 }, window: '4h' },
    { asset: 'PENDLE', state: 'EXPANSION', confidence: 0.61, scores: { accumulation: 0.12, ignition: 0.20, expansion: 0.61, distribution: 0.07 }, window: '4h' },
    { asset: 'IMX', state: 'DISTRIBUTION', confidence: 0.52, scores: { accumulation: 0.15, ignition: 0.18, expansion: 0.15, distribution: 0.52 }, window: '4h' },
  ];

  for (const als of assetLifecycles) {
    await db.collection('asset_lifecycle_states').updateOne(
      { asset: als.asset },
      { $set: { ...als, timestamp: new Date(), createdAt: new Date() } },
      { upsert: true }
    );
  }

  // === БЛОК 15: Cluster Lifecycle States ===
  const clusterLifecycles = [
    { cluster: 'AI', state: 'IGNITION', confidence: 0.53, scores: { accumulation: 0.42, ignition: 0.53, expansion: 0.05, distribution: 0.00 }, assetCount: 4, window: '4h' },
    { cluster: 'RWA', state: 'ACCUMULATION', confidence: 0.61, scores: { accumulation: 0.61, ignition: 0.28, expansion: 0.08, distribution: 0.03 }, assetCount: 3, window: '4h' },
    { cluster: 'GAMING', state: 'DISTRIBUTION', confidence: 0.48, scores: { accumulation: 0.20, ignition: 0.15, expansion: 0.17, distribution: 0.48 }, assetCount: 5, window: '4h' },
    { cluster: 'DEFI', state: 'EXPANSION', confidence: 0.58, scores: { accumulation: 0.15, ignition: 0.20, expansion: 0.58, distribution: 0.07 }, assetCount: 8, window: '4h' },
    { cluster: 'L2', state: 'IGNITION', confidence: 0.62, scores: { accumulation: 0.25, ignition: 0.62, expansion: 0.10, distribution: 0.03 }, assetCount: 6, window: '4h' },
    { cluster: 'MEME', state: 'EXPANSION', confidence: 0.70, scores: { accumulation: 0.10, ignition: 0.15, expansion: 0.70, distribution: 0.05 }, assetCount: 10, window: '4h' },
  ];

  for (const cls of clusterLifecycles) {
    await db.collection('cluster_lifecycle_states').updateOne(
      { cluster: cls.cluster },
      { $set: { ...cls, timestamp: new Date(), createdAt: new Date() } },
      { upsert: true }
    );
  }

  // === БЛОК 13: Early Rotations ===
  const earlyRotations = [
    { fromCluster: 'GAMING', toCluster: 'AI', erp: 0.68, class: 'BUILDING', tensionScore: 0.72, window: '24h', notes: { volatility: 'compressed', funding: 'negative_extreme', opportunityGrowth: '+38%', failedBreakouts: 2 } },
    { fromCluster: 'DEFI', toCluster: 'RWA', erp: 0.55, class: 'WATCH', tensionScore: 0.58, window: '24h', notes: { volatility: 'normal', funding: 'neutral', opportunityGrowth: '+22%', failedBreakouts: 1 } },
  ];

  for (const rot of earlyRotations) {
    await db.collection('early_rotations').updateOne(
      { fromCluster: rot.fromCluster, toCluster: rot.toCluster },
      { $set: { ...rot, timestamp: new Date(), createdAt: new Date() } },
      { upsert: true }
    );
  }

  // === БЛОК 16-18: Narratives ===
  const narratives = [
    { key: 'AI_AGENTS', displayName: 'AI Agents', state: 'IGNITION', nms: 0.78, velocity: 85, influencerWeight: 0.72, clusterSpread: 0.65, noveltyFactor: 0.80, linkedTokens: ['FET', 'AGIX', 'RNDR', 'TAO'], topDrivers: ['cobie', 'hsaka', 'inversebrah'], window: '24h' },
    { key: 'RWA_TOKENIZATION', displayName: 'RWA Tokenization', state: 'SEEDING', nms: 0.62, velocity: 55, influencerWeight: 0.58, clusterSpread: 0.48, noveltyFactor: 0.75, linkedTokens: ['ONDO', 'PENDLE', 'MKR'], topDrivers: ['defiignas', 'route2fi'], window: '24h' },
    { key: 'RESTAKING', displayName: 'Restaking', state: 'EXPANSION', nms: 0.85, velocity: 120, influencerWeight: 0.82, clusterSpread: 0.78, noveltyFactor: 0.45, linkedTokens: ['EIGEN', 'LDO', 'RPL'], topDrivers: ['sassal0x', 'evan_ss'], window: '24h' },
    { key: 'BTC_L2', displayName: 'Bitcoin L2', state: 'SEEDING', nms: 0.48, velocity: 35, influencerWeight: 0.52, clusterSpread: 0.38, noveltyFactor: 0.90, linkedTokens: ['STX', 'ORDI', 'RUNE'], topDrivers: ['muaboricua', 'wolfofsolana'], window: '24h' },
    { key: 'DEPIN', displayName: 'DePIN', state: 'IGNITION', nms: 0.71, velocity: 72, influencerWeight: 0.68, clusterSpread: 0.62, noveltyFactor: 0.68, linkedTokens: ['HNT', 'RNDR', 'FIL', 'AR'], topDrivers: ['cobie', 'telovedai'], window: '24h' },
  ];

  for (const n of narratives) {
    await db.collection('narratives').updateOne(
      { key: n.key },
      { $set: { ...n, timestamp: new Date(), createdAt: new Date() } },
      { upsert: true }
    );
  }

  // === Narrative Bindings ===
  const bindings = [
    { narrativeKey: 'AI_AGENTS', symbol: 'FET', weight: 0.95, reason: 'co_mention' },
    { narrativeKey: 'AI_AGENTS', symbol: 'AGIX', weight: 0.88, reason: 'co_mention' },
    { narrativeKey: 'AI_AGENTS', symbol: 'RNDR', weight: 0.75, reason: 'influencers' },
    { narrativeKey: 'AI_AGENTS', symbol: 'TAO', weight: 0.70, reason: 'co_mention' },
    { narrativeKey: 'RWA_TOKENIZATION', symbol: 'ONDO', weight: 0.92, reason: 'co_mention' },
    { narrativeKey: 'RWA_TOKENIZATION', symbol: 'PENDLE', weight: 0.78, reason: 'influencers' },
    { narrativeKey: 'RESTAKING', symbol: 'EIGEN', weight: 0.98, reason: 'co_mention' },
    { narrativeKey: 'RESTAKING', symbol: 'LDO', weight: 0.85, reason: 'co_mention' },
    { narrativeKey: 'DEPIN', symbol: 'HNT', weight: 0.88, reason: 'co_mention' },
    { narrativeKey: 'DEPIN', symbol: 'RNDR', weight: 0.72, reason: 'influencers' },
  ];

  for (const b of bindings) {
    await db.collection('narrative_bindings').updateOne(
      { narrativeKey: b.narrativeKey, symbol: b.symbol },
      { $set: { ...b, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  // === БЛОК 20: Alpha Candidates ===
  const alphaCandidates = [
    { asset: 'FET', narrative: 'AI_AGENTS', marketScore: 0.68, narrativeScore: 0.78, influencerScore: 0.72, alphaScore: 0.72, direction: 'BUY', horizon: '4h', surface: 'NARRATIVE_ROTATION', explanation: ['Narrative AI_AGENTS accelerating (+78%)', 'Drivers: cobie, hsaka', 'Exchange signal (confidence 68%)'] },
    { asset: 'ONDO', narrative: 'RWA_TOKENIZATION', marketScore: 0.55, narrativeScore: 0.62, influencerScore: 0.58, alphaScore: 0.58, direction: 'BUY', horizon: '24h', surface: 'NARRATIVE_ROTATION', explanation: ['Narrative RWA_TOKENIZATION emerging', 'Accumulation phase detected'] },
    { asset: 'EIGEN', narrative: 'RESTAKING', marketScore: 0.72, narrativeScore: 0.85, influencerScore: 0.82, alphaScore: 0.79, direction: 'BUY', horizon: '4h', surface: 'IMMEDIATE_MOMENTUM', explanation: ['Funding -0.15% (crowded shorts)', 'Narrative RESTAKING explosive', 'Drivers: sassal0x, evan_ss'] },
  ];

  for (const a of alphaCandidates) {
    await db.collection('alpha_candidates').updateOne(
      { asset: a.asset, narrative: a.narrative },
      { $set: { ...a, timestamp: new Date(), createdAt: new Date() } },
      { upsert: true }
    );
  }

  console.log('[Seed] BLOCKS 13-21 data seeded successfully');
}
