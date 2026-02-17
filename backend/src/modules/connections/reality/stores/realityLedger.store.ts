/**
 * Reality Ledger Store
 * 
 * PHASE E2: Stores verdict events for:
 * - Leaderboard (E4)
 * - Trust/penalty history
 * - Audit trail
 */

import { Db, ObjectId } from 'mongodb';
import { RealityLedgerEntry, RealityVerdict, WalletBadge } from '../contracts/reality.types.js';

let db: Db;

export function initRealityLedger(database: Db) {
  db = database;
  ensureIndexes();
  console.log('[RealityLedger] Store initialized');
}

async function ensureIndexes() {
  try {
    const col = db.collection('connections_reality_ledger');
    await col.createIndex({ actorId: 1, ts: -1 });
    await col.createIndex({ ts: -1 });
    await col.createIndex({ verdict: 1 });
    await col.createIndex({ eventId: 1 }, { unique: true, sparse: true });
    console.log('[RealityLedger] Indexes ensured');
  } catch (err) {
    console.log('[RealityLedger] Index creation skipped');
  }
}

/**
 * Record a ledger entry
 */
export async function recordLedgerEntry(
  entry: RealityLedgerEntry
): Promise<string> {
  const doc = {
    ...entry,
    _id: new ObjectId(),
    createdAt: new Date(),
  };
  
  // Upsert by eventId if provided
  if (entry.eventId) {
    await db.collection('connections_reality_ledger').updateOne(
      { eventId: entry.eventId },
      { $set: doc },
      { upsert: true }
    );
    return entry.eventId;
  }
  
  const result = await db.collection('connections_reality_ledger').insertOne(doc);
  return result.insertedId.toString();
}

/**
 * Get ledger entries for an actor
 */
export async function getActorLedger(
  actorId: string,
  windowDays: number = 30
): Promise<RealityLedgerEntry[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  
  return db.collection('connections_reality_ledger')
    .find({ actorId, ts: { $gte: since } })
    .sort({ ts: -1 })
    .limit(100)
    .toArray() as Promise<RealityLedgerEntry[]>;
}

/**
 * Get ledger entry by eventId
 */
export async function getLedgerByEvent(eventId: string): Promise<RealityLedgerEntry | null> {
  return db.collection('connections_reality_ledger')
    .findOne({ eventId }) as Promise<RealityLedgerEntry | null>;
}

/**
 * Aggregate stats by actor
 */
export async function aggregateActorStats(
  actorId: string,
  windowDays: number = 30
): Promise<{
  confirms: number;
  contradicts: number;
  nodata: number;
  total: number;
}> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  
  const result = await db.collection('connections_reality_ledger').aggregate([
    { $match: { actorId, ts: { $gte: since } } },
    {
      $group: {
        _id: null,
        confirms: { $sum: { $cond: [{ $eq: ['$verdict', 'CONFIRMS'] }, 1, 0] } },
        contradicts: { $sum: { $cond: [{ $eq: ['$verdict', 'CONTRADICTS'] }, 1, 0] } },
        nodata: { $sum: { $cond: [{ $eq: ['$verdict', 'NO_DATA'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]).toArray();
  
  return result[0] || { confirms: 0, contradicts: 0, nodata: 0, total: 0 };
}

/**
 * Get global stats
 */
export async function getGlobalStats(windowDays: number = 7): Promise<any> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  
  const result = await db.collection('connections_reality_ledger').aggregate([
    { $match: { ts: { $gte: since } } },
    {
      $group: {
        _id: '$verdict',
        count: { $sum: 1 },
      },
    },
  ]).toArray();
  
  const stats: Record<string, number> = {};
  for (const r of result) {
    stats[r._id] = r.count;
  }
  
  return {
    windowDays,
    confirms: stats.CONFIRMS || 0,
    contradicts: stats.CONTRADICTS || 0,
    nodata: stats.NO_DATA || 0,
    total: (stats.CONFIRMS || 0) + (stats.CONTRADICTS || 0) + (stats.NO_DATA || 0),
  };
}

/**
 * Seed mock data for testing
 */
export async function seedMockLedger(count: number = 100): Promise<number> {
  const existing = await db.collection('connections_reality_ledger').countDocuments();
  if (existing > 50) return 0; // Already seeded
  
  const verdicts: RealityVerdict[] = ['CONFIRMS', 'CONTRADICTS', 'NO_DATA'];
  const badges: WalletBadge[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  const actors = ['acc_1', 'acc_2', 'acc_3', 'acc_4', 'acc_5', 'acc_6', 'acc_7', 'acc_8', 'acc_9', 'acc_10'];
  
  const entries: any[] = [];
  for (let i = 0; i < count; i++) {
    const actorId = actors[Math.floor(Math.random() * actors.length)];
    const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];
    const badge = badges[Math.floor(Math.random() * badges.length)];
    
    // Bias: some actors are more "truthful"
    let adjustedVerdict = verdict;
    if (actorId === 'acc_1' || actorId === 'acc_2') {
      // High truth actors
      adjustedVerdict = Math.random() > 0.2 ? 'CONFIRMS' : verdict;
    } else if (actorId === 'acc_9' || actorId === 'acc_10') {
      // Low truth actors
      adjustedVerdict = Math.random() > 0.3 ? 'CONTRADICTS' : verdict;
    }
    
    entries.push({
      eventId: `event_${i}_${Date.now()}`,
      actorId,
      symbol: ['BTC', 'ETH', 'SOL', 'ARB'][Math.floor(Math.random() * 4)],
      verdict: adjustedVerdict,
      score_0_1: adjustedVerdict === 'CONFIRMS' ? 0.8 + Math.random() * 0.2 :
                 adjustedVerdict === 'CONTRADICTS' ? Math.random() * 0.3 : 0.4 + Math.random() * 0.2,
      walletBadge: badge,
      window: 'T0',
      evidence: [`Mock evidence ${i}`],
      ts: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
      createdAt: new Date(),
    });
  }
  
  if (entries.length > 0) {
    await db.collection('connections_reality_ledger').insertMany(entries);
  }
  
  console.log(`[RealityLedger] Seeded ${entries.length} mock entries`);
  return entries.length;
}

/**
 * Seed ledger from real unified accounts
 */
export async function seedLedgerFromUnifiedAccounts(countPerActor: number = 15): Promise<number> {
  const existing = await db.collection('connections_reality_ledger').countDocuments();
  if (existing > 100) return 0; // Already has data
  
  // Get real accounts from unified
  const accounts = await db.collection('connections_unified_accounts')
    .find({ kind: 'TWITTER', followers: { $gt: 1000 } })
    .sort({ followers: -1 })
    .limit(50)
    .toArray();
  
  if (accounts.length === 0) return 0;
  
  const verdicts: RealityVerdict[] = ['CONFIRMS', 'CONTRADICTS', 'NO_DATA'];
  const badges: WalletBadge[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  const symbols = ['BTC', 'ETH', 'SOL', 'ARB', 'DOGE', 'PEPE', 'WIF'];
  
  const entries: any[] = [];
  
  for (const account of accounts) {
    const actorId = account.id || `tw:${account.handle?.replace('@', '')}`;
    
    // Bias based on confidence score
    const confidence = account.confidence || 0.5;
    const truthBias = confidence > 0.7 ? 0.75 : confidence > 0.4 ? 0.55 : 0.35;
    
    for (let i = 0; i < countPerActor; i++) {
      // Generate verdict based on confidence bias
      let verdict: RealityVerdict;
      const roll = Math.random();
      if (roll < truthBias) {
        verdict = 'CONFIRMS';
      } else if (roll < truthBias + 0.2) {
        verdict = 'NO_DATA';
      } else {
        verdict = 'CONTRADICTS';
      }
      
      entries.push({
        eventId: `ev_${actorId}_${i}_${Date.now()}`,
        actorId,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        verdict,
        score_0_1: verdict === 'CONFIRMS' ? 0.7 + Math.random() * 0.3 :
                   verdict === 'CONTRADICTS' ? Math.random() * 0.4 : 0.4 + Math.random() * 0.2,
        walletBadge: badges[Math.floor(Math.random() * badges.length)],
        window: 'T0',
        evidence: [`Reality check ${i + 1}`],
        ts: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });
    }
  }
  
  if (entries.length > 0) {
    await db.collection('connections_reality_ledger').insertMany(entries);
  }
  
  console.log(`[RealityLedger] Seeded ${entries.length} entries from ${accounts.length} real accounts`);
  return entries.length;
}
