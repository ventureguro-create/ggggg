/**
 * IPS Seed Script
 * 
 * Generates mock IPS events for testing
 * Run: npx ts-node src/modules/ips/seed/seed-ips.ts
 */

import { MongoClient } from 'mongodb';
import { IPSEventRecord, Outcome, IPSVerdict, IPSFactors, MarketSnapshot } from '../models/ips.types';
import { WindowKey } from '../constants/ips.constants';

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'fomo';

// Sample actors (matching existing influencers)
const ACTORS = [
  { id: 'cobie', name: 'Cobie', influence: 'high' },
  { id: 'hsaka', name: 'HSAKA', influence: 'high' },
  { id: 'punk6529', name: 'punk6529', influence: 'high' },
  { id: 'zachxbt', name: 'ZachXBT', influence: 'medium' },
  { id: 'degenharambe', name: 'Degen Harambe', influence: 'medium' },
  { id: 'blknoiz06', name: 'blknoiz06', influence: 'medium' },
  { id: 'trader_j', name: 'Trader J', influence: 'low' },
  { id: 'anon_whale', name: 'Anon Whale', influence: 'low' }
];

// Sample assets
const ASSETS = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'BLUR', 'PEPE', 'GMX'];

// Outcome distribution based on actor influence
const OUTCOME_WEIGHTS: Record<string, Record<Outcome, number>> = {
  high: { POSITIVE_MOVE: 0.4, NEGATIVE_MOVE: 0.15, NO_EFFECT: 0.3, VOLATILITY_SPIKE: 0.15 },
  medium: { POSITIVE_MOVE: 0.3, NEGATIVE_MOVE: 0.2, NO_EFFECT: 0.35, VOLATILITY_SPIKE: 0.15 },
  low: { POSITIVE_MOVE: 0.2, NEGATIVE_MOVE: 0.25, NO_EFFECT: 0.45, VOLATILITY_SPIKE: 0.1 }
};

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T extends string>(weights: Record<T, number>): T {
  const total = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
  let r = Math.random() * total;
  
  for (const [key, weight] of Object.entries(weights)) {
    r -= weight as number;
    if (r <= 0) return key as T;
  }
  
  return Object.keys(weights)[0] as T;
}

function generateSnapshot(outcome: Outcome): MarketSnapshot {
  const base = {
    POSITIVE_MOVE: { price: rnd(1.5, 8), vol: rnd(0.5, 2) },
    NEGATIVE_MOVE: { price: rnd(-8, -1.5), vol: rnd(0.5, 2) },
    NO_EFFECT: { price: rnd(-1, 1), vol: rnd(-0.5, 0.5) },
    VOLATILITY_SPIKE: { price: rnd(-3, 3), vol: rnd(2.5, 5) }
  };
  
  const b = base[outcome];
  return {
    priceDelta: Math.round(b.price * 100) / 100,
    volumeDelta: Math.round(rnd(0.8, 1.5) * 100) / 100,
    volatility: Math.round(b.vol * 100) / 100,
    onchainFlow: Math.round(rnd(-1, 1) * 100) / 100
  };
}

function generateFactors(influence: string, outcome: Outcome): IPSFactors {
  const baseScores = {
    high: { direction: 0.75, time: 0.7, consistency: 0.8, independence: 0.85, reality: 0.75 },
    medium: { direction: 0.6, time: 0.55, consistency: 0.6, independence: 0.6, reality: 0.6 },
    low: { direction: 0.45, time: 0.4, consistency: 0.4, independence: 0.35, reality: 0.45 }
  };
  
  const base = baseScores[influence as keyof typeof baseScores] || baseScores.medium;
  const noise = () => rnd(-0.15, 0.15);
  
  return {
    direction: Math.round(Math.max(0, Math.min(1, base.direction + noise())) * 1000) / 1000,
    time: Math.round(Math.max(0, Math.min(1, base.time + noise())) * 1000) / 1000,
    consistency: Math.round(Math.max(0, Math.min(1, base.consistency + noise())) * 1000) / 1000,
    independence: Math.round(Math.max(0, Math.min(1, base.independence + noise())) * 1000) / 1000,
    reality: Math.round(Math.max(0, Math.min(1, base.reality + noise())) * 1000) / 1000
  };
}

function computeIPS(factors: IPSFactors): number {
  const raw = 
    0.25 * factors.direction +
    0.25 * factors.time +
    0.20 * factors.consistency +
    0.15 * factors.independence +
    0.15 * factors.reality;
  
  return Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 1000;
}

function getVerdict(ips: number): IPSVerdict {
  if (ips >= 0.65) return 'INFORMED';
  if (ips < 0.35) return 'NOISE';
  return 'MIXED';
}

async function seed() {
  console.log('[IPS Seed] Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  
  const db = client.db(DB_NAME);
  const col = db.collection<IPSEventRecord>('ips_events');
  
  // Clear existing
  await col.deleteMany({});
  console.log('[IPS Seed] Cleared existing IPS events');
  
  const docs: Omit<IPSEventRecord, '_id'>[] = [];
  const now = Date.now();
  const windows: WindowKey[] = ['1h', '4h', '24h'];
  
  // Generate events for each actor
  for (const actor of ACTORS) {
    const eventCount = actor.influence === 'high' ? rnd(30, 50) : 
                       actor.influence === 'medium' ? rnd(15, 30) : 
                       rnd(5, 15);
    
    for (let i = 0; i < eventCount; i++) {
      const asset = pick(ASSETS);
      const eventId = `evt_${actor.id}_${i}_${Date.now().toString(36)}`;
      const timestamp = now - rnd(1, 30) * 24 * 60 * 60 * 1000; // Last 30 days
      
      const outcome = weightedPick(OUTCOME_WEIGHTS[actor.influence]);
      const window = pick(windows);
      const factors = generateFactors(actor.influence, outcome);
      const ips = computeIPS(factors);
      const verdict = getVerdict(ips);
      const snapshot = generateSnapshot(outcome);
      
      docs.push({
        eventId,
        actorId: actor.id,
        asset,
        timestamp,
        window,
        outcome,
        ips,
        verdict,
        factors,
        snapshot,
        reality: {
          verdict: Math.random() > 0.3 ? 'CONFIRMS' : Math.random() > 0.5 ? 'CONTRADICTS' : 'NO_DATA',
          realityScore: Math.round(rnd(0.3, 0.9) * 100) / 100,
          walletCredibility: Math.round(rnd(0.4, 0.95) * 100) / 100
        },
        meta: {
          eventType: pick(['tweet', 'reply', 'quote']),
          reach: Math.floor(rnd(1000, 500000)),
          seeded: true
        },
        createdAt: timestamp,
        updatedAt: now
      });
    }
  }
  
  // Insert
  await col.insertMany(docs as any);
  console.log(`[IPS Seed] Inserted ${docs.length} IPS events`);
  
  // Create indexes
  await col.createIndex({ actorId: 1, timestamp: -1 });
  await col.createIndex({ asset: 1, timestamp: -1 });
  await col.createIndex({ eventId: 1, window: 1 }, { unique: true });
  await col.createIndex({ window: 1, timestamp: -1 });
  await col.createIndex({ verdict: 1, timestamp: -1 });
  console.log('[IPS Seed] Indexes created');
  
  // Summary
  const summary = await col.aggregate([
    {
      $group: {
        _id: '$actorId',
        count: { $sum: 1 },
        avgIPS: { $avg: '$ips' }
      }
    },
    { $sort: { avgIPS: -1 } }
  ]).toArray();
  
  console.log('\n[IPS Seed] Summary by actor:');
  for (const s of summary) {
    console.log(`  ${s._id}: ${s.count} events, avg IPS: ${(s.avgIPS as number).toFixed(3)}`);
  }
  
  await client.close();
  console.log('\n[IPS Seed] Done!');
}

// Run if called directly
seed().catch(err => {
  console.error('[IPS Seed] Error:', err);
  process.exit(1);
});
