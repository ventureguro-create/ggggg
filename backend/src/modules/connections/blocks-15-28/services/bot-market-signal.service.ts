/**
 * BLOCK 23 - Bot Market Signals Service
 * 
 * Turns bot activity into market manipulation signals
 */

import type { Db, Collection, Document } from 'mongodb';
import { calculateBMS, getBMSLabel, type BMSLabel } from '../formulas/bot-market-signal.js';

export interface BotMarketSignalReport {
  actorId: string;
  window: string;
  botInflowRate: number;
  overlapScore: number;
  burstScore: number;
  bms: number;
  label: BMSLabel;
  timestamp: string;
}

export class BotMarketSignalService {
  private followerNodes: Collection<Document>;
  private farmOverlapEdges: Collection<Document>;
  private bmsReports: Collection<Document>;

  constructor(private db: Db) {
    this.followerNodes = db.collection('follower_nodes');
    this.farmOverlapEdges = db.collection('farm_overlap_edges');
    this.bmsReports = db.collection('bot_market_signals');
  }

  /**
   * Calculate BMS for an actor
   */
  async compute(actorId: string, window = '24h'): Promise<BotMarketSignalReport> {
    const windowHours = window === '24h' ? 24 : parseInt(window);
    const since = new Date(Date.now() - windowHours * 3600000);

    // Calculate bot inflow rate
    const botInflowRate = await this.calculateBotInflowRate(actorId, since);

    // Calculate overlap score
    const overlapScore = await this.calculateOverlapScore(actorId);

    // Calculate burst score
    const burstScore = await this.calculateBurstScore(actorId, since);

    // Calculate BMS
    const bms = calculateBMS({ botInflowRate, overlapScore, burstScore });
    const label = getBMSLabel(bms);

    const report: BotMarketSignalReport = {
      actorId,
      window,
      botInflowRate: Math.round(botInflowRate * 100) / 100,
      overlapScore: Math.round(overlapScore * 100) / 100,
      burstScore: Math.round(burstScore * 100) / 100,
      bms,
      label,
      timestamp: new Date().toISOString()
    };

    // Cache
    await this.bmsReports.updateOne(
      { actorId, window },
      { $set: report },
      { upsert: true }
    );

    return report;
  }

  /**
   * Get cached BMS report
   */
  async get(actorId: string, window = '24h'): Promise<BotMarketSignalReport | null> {
    const doc = await this.bmsReports.findOne({ actorId, window });
    return doc as unknown as BotMarketSignalReport | null;
  }

  /**
   * Calculate bot inflow rate
   */
  private async calculateBotInflowRate(actorId: string, since: Date): Promise<number> {
    const newFollowers = await this.followerNodes.countDocuments({
      actorId,
      createdAt: { $gte: since }
    });

    const newBots = await this.followerNodes.countDocuments({
      actorId,
      createdAt: { $gte: since },
      label: { $in: ['BOT', 'BOT_LIKELY', 'FARM_NODE', 'SUSPICIOUS'] }
    });

    if (!newFollowers) return 0;
    return newBots / newFollowers;
  }

  /**
   * Calculate overlap score from farm edges
   */
  private async calculateOverlapScore(actorId: string): Promise<number> {
    const edges = await this.farmOverlapEdges
      .find({ $or: [{ a: actorId }, { b: actorId }] })
      .limit(20)
      .toArray();

    if (!edges.length) return 0;
    return edges.reduce((s, e: any) => s + e.overlapScore, 0) / edges.length;
  }

  /**
   * Calculate burst score (recent spike vs avg)
   */
  private async calculateBurstScore(actorId: string, since: Date): Promise<number> {
    const hourAgo = new Date(Date.now() - 3600000);

    const recentBots = await this.followerNodes.countDocuments({
      actorId,
      createdAt: { $gte: hourAgo },
      label: { $in: ['BOT', 'BOT_LIKELY', 'FARM_NODE'] }
    });

    const avgBots = await this.followerNodes.countDocuments({
      actorId,
      createdAt: { $gte: since },
      label: { $in: ['BOT', 'BOT_LIKELY', 'FARM_NODE'] }
    });

    const hoursInWindow = (Date.now() - since.getTime()) / 3600000;
    const avgPerHour = avgBots / Math.max(1, hoursInWindow);

    if (!avgPerHour) return 0;
    return Math.min(1, (recentBots / avgPerHour) / 4); // Normalize, >4x = 1
  }
}
