/**
 * Seed script for Connections Module - Twitter Accounts and Graph data
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '/app/backend/.env' });

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/connections_db';

// Twitter accounts with real handles
const twitterAccounts = [
  // VCs (S-tier)
  { handle: 'a16z', displayName: 'a16z', category: 'VC', tier: 'S', followers: 1200000, following: 245, trustScore: 0.92, botProbability: 0.02 },
  { handle: 'paradigm', displayName: 'Paradigm', category: 'VC', tier: 'S', followers: 450000, following: 189, trustScore: 0.91, botProbability: 0.03 },
  { handle: 'sequoia', displayName: 'Sequoia', category: 'VC', tier: 'S', followers: 890000, following: 320, trustScore: 0.90, botProbability: 0.02 },
  { handle: 'binancelabs', displayName: 'Binance Labs', category: 'VC', tier: 'S', followers: 650000, following: 156, trustScore: 0.88, botProbability: 0.04 },
  { handle: 'polychain', displayName: 'Polychain Capital', category: 'VC', tier: 'A', followers: 180000, following: 95, trustScore: 0.85, botProbability: 0.05 },
  { handle: 'panteracapital', displayName: 'Pantera Capital', category: 'VC', tier: 'A', followers: 210000, following: 120, trustScore: 0.84, botProbability: 0.05 },
  { handle: 'multicoincap', displayName: 'Multicoin Capital', category: 'VC', tier: 'A', followers: 95000, following: 78, trustScore: 0.83, botProbability: 0.06 },
  
  // KOLs (A-tier)  
  { handle: 'cobie', displayName: 'Cobie', category: 'KOL', tier: 'S', followers: 890000, following: 456, trustScore: 0.88, botProbability: 0.08 },
  { handle: 'hsaka', displayName: 'Hsaka', category: 'KOL', tier: 'A', followers: 220000, following: 312, trustScore: 0.82, botProbability: 0.12 },
  { handle: 'pentoshi', displayName: 'Pentoshi', category: 'KOL', tier: 'A', followers: 680000, following: 289, trustScore: 0.79, botProbability: 0.15 },
  { handle: 'raoulpal', displayName: 'Raoul Pal', category: 'KOL', tier: 'S', followers: 1100000, following: 567, trustScore: 0.86, botProbability: 0.06 },
  { handle: 'willywoo', displayName: 'Willy Woo', category: 'KOL', tier: 'A', followers: 1000000, following: 234, trustScore: 0.84, botProbability: 0.08 },
  { handle: 'planb', displayName: 'PlanB', category: 'KOL', tier: 'A', followers: 1900000, following: 145, trustScore: 0.75, botProbability: 0.18 },
  { handle: 'inversebrah', displayName: 'inversebrah', category: 'KOL', tier: 'B', followers: 320000, following: 412, trustScore: 0.72, botProbability: 0.22 },
  { handle: 'route2fi', displayName: 'Route 2 FI', category: 'KOL', tier: 'B', followers: 180000, following: 356, trustScore: 0.71, botProbability: 0.20 },
  { handle: 'defiignas', displayName: 'DeFi Ignas', category: 'KOL', tier: 'B', followers: 250000, following: 478, trustScore: 0.73, botProbability: 0.18 },
  
  // Founders (S-tier)
  { handle: 'vitalikbuterin', displayName: 'Vitalik Buterin', category: 'FOUNDER', tier: 'S', followers: 5200000, following: 389, trustScore: 0.95, botProbability: 0.02 },
  { handle: 'caboricua', displayName: 'CZ', category: 'FOUNDER', tier: 'S', followers: 8900000, following: 245, trustScore: 0.88, botProbability: 0.05 },
  { handle: 'brian_armstrong', displayName: 'Brian Armstrong', category: 'FOUNDER', tier: 'S', followers: 1500000, following: 156, trustScore: 0.90, botProbability: 0.03 },
  { handle: 'balaboricua', displayName: 'Balaji', category: 'FOUNDER', tier: 'A', followers: 980000, following: 567, trustScore: 0.85, botProbability: 0.06 },
  
  // Analysts (B-tier)
  { handle: 'lookonchain', displayName: 'Lookonchain', category: 'ANALYST', tier: 'A', followers: 780000, following: 123, trustScore: 0.82, botProbability: 0.10 },
  { handle: 'glassnode', displayName: 'Glassnode', category: 'ANALYST', tier: 'A', followers: 420000, following: 89, trustScore: 0.85, botProbability: 0.08 },
  { handle: 'nansen_ai', displayName: 'Nansen', category: 'ANALYST', tier: 'A', followers: 280000, following: 156, trustScore: 0.84, botProbability: 0.09 },
];

// Farm network data for Farm Network Graph
const farmOverlapEdges = [
  { source: 'crypto_whale_alerts', target: 'moon_signals', sharedBots: 156, weight: 0.78, confidence: 0.85 },
  { source: 'crypto_whale_alerts', target: 'degen_pumps', sharedBots: 89, weight: 0.65, confidence: 0.72 },
  { source: 'moon_signals', target: 'alpha_leaks', sharedBots: 124, weight: 0.72, confidence: 0.80 },
  { source: 'moon_signals', target: 'gem_hunters', sharedBots: 67, weight: 0.55, confidence: 0.68 },
  { source: 'degen_pumps', target: 'ape_nation', sharedBots: 198, weight: 0.82, confidence: 0.88 },
  { source: 'alpha_leaks', target: 'insider_calls', sharedBots: 145, weight: 0.75, confidence: 0.82 },
  { source: 'gem_hunters', target: 'micro_caps', sharedBots: 78, weight: 0.58, confidence: 0.65 },
  { source: 'ape_nation', target: 'fomo_trades', sharedBots: 112, weight: 0.68, confidence: 0.75 },
  { source: 'insider_calls', target: 'whale_watchers', sharedBots: 89, weight: 0.62, confidence: 0.70 },
  { source: 'micro_caps', target: 'gem_sniper', sharedBots: 56, weight: 0.48, confidence: 0.58 },
  { source: 'fomo_trades', target: 'pump_detector', sharedBots: 134, weight: 0.71, confidence: 0.78 },
  { source: 'whale_watchers', target: 'smart_money', sharedBots: 167, weight: 0.79, confidence: 0.85 },
];

// Farm network nodes
const farmNodes = [
  { actorId: 'crypto_whale_alerts', handle: 'crypto_whale_alerts', riskLevel: 'HIGH', aqi: 28, botPct: 62, humanPct: 25, suspiciousPct: 13, authenticityScore: 0.32 },
  { actorId: 'moon_signals', handle: 'moon_signals', riskLevel: 'HIGH', aqi: 31, botPct: 58, humanPct: 28, suspiciousPct: 14, authenticityScore: 0.35 },
  { actorId: 'degen_pumps', handle: 'degen_pumps', riskLevel: 'CRITICAL', aqi: 18, botPct: 72, humanPct: 18, suspiciousPct: 10, authenticityScore: 0.22 },
  { actorId: 'alpha_leaks', handle: 'alpha_leaks', riskLevel: 'MEDIUM', aqi: 45, botPct: 42, humanPct: 40, suspiciousPct: 18, authenticityScore: 0.48 },
  { actorId: 'gem_hunters', handle: 'gem_hunters', riskLevel: 'MEDIUM', aqi: 52, botPct: 35, humanPct: 48, suspiciousPct: 17, authenticityScore: 0.55 },
  { actorId: 'ape_nation', handle: 'ape_nation', riskLevel: 'CRITICAL', aqi: 15, botPct: 78, humanPct: 12, suspiciousPct: 10, authenticityScore: 0.18 },
  { actorId: 'insider_calls', handle: 'insider_calls', riskLevel: 'HIGH', aqi: 25, botPct: 65, humanPct: 22, suspiciousPct: 13, authenticityScore: 0.28 },
  { actorId: 'micro_caps', handle: 'micro_caps', riskLevel: 'LOW', aqi: 68, botPct: 22, humanPct: 62, suspiciousPct: 16, authenticityScore: 0.72 },
  { actorId: 'fomo_trades', handle: 'fomo_trades', riskLevel: 'HIGH', aqi: 32, botPct: 55, humanPct: 30, suspiciousPct: 15, authenticityScore: 0.38 },
  { actorId: 'whale_watchers', handle: 'whale_watchers', riskLevel: 'MEDIUM', aqi: 48, botPct: 38, humanPct: 45, suspiciousPct: 17, authenticityScore: 0.52 },
];

// Influencer clusters
const influencerClusters = [
  {
    clusterId: 0,
    name: 'VC_ELITE',
    members: ['a16z', 'paradigm', 'sequoia', 'cobie', 'hsaka', 'binancelabs', 'polychain', 'panteracapital', 'multicoincap', 'vitalikbuterin', 'brian_armstrong', 'balaboricua', 'inversebrah'],
    avgInfluence: 0.85,
    avgTrustScore: 0.88,
    tokenFocus: ['ETH', 'SOL', 'ONDO', 'ARB'],
    createdAt: new Date()
  },
  {
    clusterId: 1,
    name: 'ANALYST_HUB',
    members: ['raoulpal', 'willywoo', 'pentoshi', 'planb', 'lookonchain'],
    avgInfluence: 0.72,
    avgTrustScore: 0.78,
    tokenFocus: ['BTC', 'ETH', 'SOL'],
    createdAt: new Date()
  }
];

// Cluster token momentum data
const clusterMomentum = [
  { token: 'ONDO', clusterId: 0, score: 4.15, classification: 'PUMP_LIKE', timestamp: new Date() },
  { token: 'ARB', clusterId: 0, score: 2.41, classification: 'PUMP_LIKE', timestamp: new Date() },
  { token: 'SOL', clusterId: 0, score: 1.85, classification: 'MOMENTUM', timestamp: new Date() },
  { token: 'BTC', clusterId: 1, score: 0.92, classification: 'ATTENTION', timestamp: new Date() },
  { token: 'ETH', clusterId: 0, score: 0.55, classification: 'ATTENTION', timestamp: new Date() },
];

// Cluster credibility
const clusterCredibility = [
  { clusterId: 0, credibilityScore: 0.64, confirmationRate: 0.67, avgReturnOnCall: 0.12, sampleSize: 48 },
  { clusterId: 1, credibilityScore: 0.05, confirmationRate: 0.45, avgReturnOnCall: 0.05, sampleSize: 23 },
];

// Cluster alignments
const clusterAlignments = [
  { token: 'ARB', alignment: 'CONFIRMED', returnPct: 3.69, lag: '2h', clusterId: 0 },
  { token: 'ETH', alignment: 'CONFIRMED', returnPct: 3.70, lag: '4h', clusterId: 0 },
  { token: 'BTC', alignment: 'LAGGING', returnPct: 1.2, lag: '8h', clusterId: 1 },
];

// Unified accounts for Radar
const unifiedAccounts = [
  { handle: 'megawhale', displayName: 'MegaWhale', influenceScore: 92, acceleration: 0.15, tier: 'WHALE', followers: 2650000, category: 'whale', breakoutPotential: 0.25 },
  { handle: 'cryptoking', displayName: 'CryptoKing', influenceScore: 88, acceleration: 0.22, tier: 'WHALE', followers: 1500000, category: 'whale', breakoutPotential: 0.32 },
  { handle: 'defi_master', displayName: 'DeFi Master', influenceScore: 75, acceleration: 0.45, tier: 'INFLUENCER', followers: 450000, category: 'influencer', breakoutPotential: 0.68 },
  { handle: 'alpha_seeker', displayName: 'Alpha Seeker', influenceScore: 68, acceleration: 0.58, tier: 'INFLUENCER', followers: 280000, category: 'influencer', breakoutPotential: 0.72 },
  { handle: 'chart_wizard', displayName: 'Chart Wizard', influenceScore: 62, acceleration: 0.35, tier: 'INFLUENCER', followers: 180000, category: 'influencer', breakoutPotential: 0.55 },
  { handle: 'degen_trader', displayName: 'Degen Trader', influenceScore: 45, acceleration: 0.82, tier: 'RETAIL', followers: 45000, category: 'retail', breakoutPotential: 0.88 },
  { handle: 'moon_hunter', displayName: 'Moon Hunter', influenceScore: 38, acceleration: 0.75, tier: 'RETAIL', followers: 28000, category: 'retail', breakoutPotential: 0.85 },
  { handle: 'crypto_newbie', displayName: 'Crypto Newbie', influenceScore: 22, acceleration: 0.92, tier: 'RETAIL', followers: 8500, category: 'retail', breakoutPotential: 0.95 },
];

// Follow graph edges
function generateFollowGraph() {
  const edges: any[] = [];
  const accounts = twitterAccounts.map(a => a.handle);
  
  // VCs follow each other
  const vcs = twitterAccounts.filter(a => a.category === 'VC').map(a => a.handle);
  for (let i = 0; i < vcs.length; i++) {
    for (let j = i + 1; j < vcs.length; j++) {
      if (Math.random() > 0.3) {
        edges.push({ follower: vcs[i], following: vcs[j], weight: 0.8 + Math.random() * 0.2 });
      }
    }
  }
  
  // KOLs follow VCs
  const kols = twitterAccounts.filter(a => a.category === 'KOL').map(a => a.handle);
  for (const kol of kols) {
    for (const vc of vcs) {
      if (Math.random() > 0.4) {
        edges.push({ follower: kol, following: vc, weight: 0.6 + Math.random() * 0.3 });
      }
    }
  }
  
  // Add more random connections
  for (let i = 0; i < 50; i++) {
    const from = accounts[Math.floor(Math.random() * accounts.length)];
    const to = accounts[Math.floor(Math.random() * accounts.length)];
    if (from !== to) {
      edges.push({ follower: from, following: to, weight: 0.3 + Math.random() * 0.5 });
    }
  }
  
  return edges;
}

async function seed() {
  console.log('[Seed] Connecting to MongoDB:', MONGO_URL);
  await mongoose.connect(MONGO_URL);
  console.log('[Seed] Connected');
  
  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');
  
  // Seed twitter accounts
  console.log('[Seed] Seeding twitter_accounts...');
  for (const acc of twitterAccounts) {
    await db.collection('twitter_accounts').updateOne(
      { handle: acc.handle },
      { $set: { ...acc, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`[Seed] ✅ Seeded ${twitterAccounts.length} twitter accounts`);
  
  // Seed farm overlap edges
  console.log('[Seed] Seeding farm_overlap_edges...');
  await db.collection('farm_overlap_edges').deleteMany({});
  await db.collection('farm_overlap_edges').insertMany(farmOverlapEdges.map(e => ({ ...e, createdAt: new Date() })));
  console.log(`[Seed] ✅ Seeded ${farmOverlapEdges.length} farm edges`);
  
  // Seed farm nodes (audience quality reports)
  console.log('[Seed] Seeding audience_quality_reports...');
  for (const node of farmNodes) {
    await db.collection('audience_quality_reports').updateOne(
      { actorId: node.actorId },
      { $set: { ...node, createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`[Seed] ✅ Seeded ${farmNodes.length} farm nodes`);
  
  // Seed influencer clusters
  console.log('[Seed] Seeding influencer_clusters...');
  for (const cluster of influencerClusters) {
    await db.collection('influencer_clusters').updateOne(
      { clusterId: cluster.clusterId },
      { $set: cluster },
      { upsert: true }
    );
  }
  console.log(`[Seed] ✅ Seeded ${influencerClusters.length} clusters`);
  
  // Seed cluster momentum
  console.log('[Seed] Seeding cluster_token_momentum...');
  for (const m of clusterMomentum) {
    await db.collection('cluster_token_momentum').updateOne(
      { token: m.token },
      { $set: m },
      { upsert: true }
    );
  }
  console.log(`[Seed] ✅ Seeded ${clusterMomentum.length} momentum records`);
  
  // Seed cluster credibility
  console.log('[Seed] Seeding cluster_credibility...');
  for (const c of clusterCredibility) {
    await db.collection('cluster_credibility').updateOne(
      { clusterId: c.clusterId },
      { $set: { ...c, createdAt: new Date() } },
      { upsert: true }
    );
  }
  
  // Seed cluster alignments
  console.log('[Seed] Seeding cluster_alignments...');
  await db.collection('cluster_alignments').deleteMany({});
  await db.collection('cluster_alignments').insertMany(clusterAlignments.map(a => ({ ...a, createdAt: new Date() })));
  
  // Seed unified accounts for radar
  console.log('[Seed] Seeding connections_unified_accounts...');
  for (const acc of unifiedAccounts) {
    await db.collection('connections_unified_accounts').updateOne(
      { handle: acc.handle },
      { $set: { ...acc, createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`[Seed] ✅ Seeded ${unifiedAccounts.length} unified accounts`);
  
  // Seed follow graph
  console.log('[Seed] Seeding connections_follow_graph...');
  const edges = generateFollowGraph();
  await db.collection('connections_follow_graph').deleteMany({});
  await db.collection('connections_follow_graph').insertMany(edges.map(e => ({ ...e, createdAt: new Date() })));
  console.log(`[Seed] ✅ Seeded ${edges.length} follow edges`);
  
  console.log('[Seed] ✅ All data seeded successfully!');
  await mongoose.disconnect();
}

seed().catch(console.error);
