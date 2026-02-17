/**
 * IPS Persistence Service
 * 
 * PHASE G5: Storage for IPS events and aggregations
 */

import { Db, Collection } from 'mongodb';
import { IPSEventRecord, ActorIPSStats, AssetIPSStats, IPSVerdict } from '../models/ips.types';
import { WindowKey, IPS_GUARD_RAILS, IPS_VERDICTS } from '../constants/ips.constants';

const COLLECTION_EVENTS = 'ips_events';
const COLLECTION_ACTOR_STATS = 'ips_actor_stats';
const COLLECTION_ASSET_STATS = 'ips_asset_stats';

export class IPSPersistService {
  private db: Db;
  
  constructor(db: Db) {
    this.db = db;
  }
  
  private events(): Collection<IPSEventRecord> {
    return this.db.collection(COLLECTION_EVENTS);
  }
  
  private actorStats(): Collection<ActorIPSStats> {
    return this.db.collection(COLLECTION_ACTOR_STATS);
  }
  
  private assetStats(): Collection<AssetIPSStats> {
    return this.db.collection(COLLECTION_ASSET_STATS);
  }
  
  /**
   * Persist IPS event with explain payload
   */
  async persistEvent(record: Omit<IPSEventRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = Date.now();
    
    await this.events().updateOne(
      { eventId: record.eventId, window: record.window },
      {
        $set: { ...record, updatedAt: now },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
  }
  
  /**
   * Get events for timeline
   */
  async getTimeline(params: {
    actorId?: string;
    asset?: string;
    window?: WindowKey;
    from?: number;
    to?: number;
    verdict?: IPSVerdict;
    minIPS?: number;
    limit?: number;
  }): Promise<IPSEventRecord[]> {
    const match: any = {};
    
    if (params.actorId) match.actorId = params.actorId;
    if (params.asset) match.asset = params.asset.toUpperCase();
    if (params.window) match.window = params.window;
    if (params.verdict) match.verdict = params.verdict;
    if (params.minIPS !== undefined) match.ips = { $gte: params.minIPS };
    
    if (params.from || params.to) {
      match.timestamp = {};
      if (params.from) match.timestamp.$gte = params.from;
      if (params.to) match.timestamp.$lte = params.to;
    }
    
    return this.events()
      .find(match)
      .sort({ timestamp: -1 })
      .limit(params.limit || 200)
      .project({ _id: 0 })
      .toArray() as Promise<IPSEventRecord[]>;
  }
  
  /**
   * Get aggregated stats for timeline query
   */
  async getTimelineStats(match: any): Promise<{
    n: number;
    avgIPS: number;
    p50: number;
    p90: number;
  }> {
    const result = await this.events().aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          n: { $sum: 1 },
          avgIPS: { $avg: '$ips' },
          allIPS: { $push: '$ips' }
        }
      },
      {
        $project: {
          _id: 0,
          n: 1,
          avgIPS: { $round: ['$avgIPS', 3] }
        }
      }
    ]).toArray();
    
    if (result.length === 0) {
      return { n: 0, avgIPS: 0, p50: 0, p90: 0 };
    }
    
    return {
      n: result[0].n,
      avgIPS: result[0].avgIPS || 0,
      p50: result[0].avgIPS || 0,  // Simplified
      p90: result[0].avgIPS || 0   // Simplified
    };
  }
  
  /**
   * Update actor aggregated stats
   */
  async updateActorStats(actorId: string): Promise<ActorIPSStats> {
    const events = await this.events()
      .find({ actorId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    if (events.length === 0) {
      return {
        actorId,
        totalEvents: 0,
        avgIPS: 0,
        p50: 0,
        p90: 0,
        verdict: 'INSUFFICIENT_DATA',
        windows: {
          '1h': { avgIPS: 0, count: 0 },
          '4h': { avgIPS: 0, count: 0 },
          '24h': { avgIPS: 0, count: 0 }
        },
        outcomes: {
          POSITIVE_MOVE: 0,
          NEGATIVE_MOVE: 0,
          NO_EFFECT: 0,
          VOLATILITY_SPIKE: 0
        },
        lastUpdated: Date.now()
      };
    }
    
    // Calculate aggregates
    const ipsValues = events.map(e => e.ips).sort((a, b) => a - b);
    const avgIPS = ipsValues.reduce((a, b) => a + b, 0) / ipsValues.length;
    const p50 = ipsValues[Math.floor(ipsValues.length * 0.5)] || 0;
    const p90 = ipsValues[Math.floor(ipsValues.length * 0.9)] || 0;
    
    // Window breakdown
    const windows = { '1h': [], '4h': [], '24h': [] } as Record<WindowKey, number[]>;
    events.forEach(e => {
      if (windows[e.window]) windows[e.window].push(e.ips);
    });
    
    // Outcomes
    const outcomes = { POSITIVE_MOVE: 0, NEGATIVE_MOVE: 0, NO_EFFECT: 0, VOLATILITY_SPIKE: 0 };
    events.forEach(e => {
      if (outcomes[e.outcome] !== undefined) outcomes[e.outcome]++;
    });
    
    // Verdict
    let verdict: IPSVerdict = 'MIXED';
    if (events.length < IPS_GUARD_RAILS.minEvents) {
      verdict = 'INSUFFICIENT_DATA';
    } else if (avgIPS >= IPS_VERDICTS.informed) {
      verdict = 'INFORMED';
    } else if (avgIPS < IPS_VERDICTS.noise) {
      verdict = 'NOISE';
    }
    
    const stats: ActorIPSStats = {
      actorId,
      totalEvents: events.length,
      avgIPS: Math.round(avgIPS * 1000) / 1000,
      p50: Math.round(p50 * 1000) / 1000,
      p90: Math.round(p90 * 1000) / 1000,
      verdict,
      windows: {
        '1h': { 
          avgIPS: windows['1h'].length ? windows['1h'].reduce((a, b) => a + b, 0) / windows['1h'].length : 0,
          count: windows['1h'].length 
        },
        '4h': { 
          avgIPS: windows['4h'].length ? windows['4h'].reduce((a, b) => a + b, 0) / windows['4h'].length : 0,
          count: windows['4h'].length 
        },
        '24h': { 
          avgIPS: windows['24h'].length ? windows['24h'].reduce((a, b) => a + b, 0) / windows['24h'].length : 0,
          count: windows['24h'].length 
        }
      },
      outcomes,
      lastUpdated: Date.now()
    };
    
    await this.actorStats().updateOne(
      { actorId },
      { $set: stats },
      { upsert: true }
    );
    
    return stats;
  }
  
  /**
   * Get actor stats
   */
  async getActorStats(actorId: string): Promise<ActorIPSStats | null> {
    const cached = await this.actorStats().findOne(
      { actorId },
      { projection: { _id: 0 } }
    );
    
    if (cached && Date.now() - cached.lastUpdated < 5 * 60 * 1000) {
      return cached as ActorIPSStats;
    }
    
    return this.updateActorStats(actorId);
  }
  
  /**
   * Get asset stats
   */
  async getAssetStats(asset: string): Promise<AssetIPSStats> {
    const assetUpper = asset.toUpperCase();
    
    const events = await this.events()
      .find({ asset: assetUpper })
      .sort({ timestamp: -1 })
      .limit(500)
      .toArray();
    
    if (events.length === 0) {
      return {
        asset: assetUpper,
        totalEvents: 0,
        avgIPS: 0,
        topActors: [],
        lastUpdated: Date.now()
      };
    }
    
    // Group by actor
    const actorMap = new Map<string, { total: number; count: number }>();
    events.forEach(e => {
      const existing = actorMap.get(e.actorId) || { total: 0, count: 0 };
      existing.total += e.ips;
      existing.count++;
      actorMap.set(e.actorId, existing);
    });
    
    const topActors = Array.from(actorMap.entries())
      .map(([actorId, data]) => ({
        actorId,
        avgIPS: Math.round((data.total / data.count) * 1000) / 1000,
        eventCount: data.count
      }))
      .sort((a, b) => b.avgIPS - a.avgIPS)
      .slice(0, 10);
    
    const avgIPS = events.reduce((a, b) => a + b.ips, 0) / events.length;
    
    return {
      asset: assetUpper,
      totalEvents: events.length,
      avgIPS: Math.round(avgIPS * 1000) / 1000,
      topActors,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Create indexes
   */
  async ensureIndexes(): Promise<void> {
    await this.events().createIndex({ actorId: 1, timestamp: -1 });
    await this.events().createIndex({ asset: 1, timestamp: -1 });
    await this.events().createIndex({ eventId: 1, window: 1 }, { unique: true });
    await this.events().createIndex({ window: 1, timestamp: -1 });
    await this.events().createIndex({ verdict: 1, timestamp: -1 });
  }
}
