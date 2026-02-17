/**
 * BLOCK 16 - Audience Quality Service
 * 
 * Computes AQI (Audience Quality Index) for influencers
 */

import type { Db, Collection, Document } from 'mongodb';
import { computeAqi, type AQILevel } from '../formulas/aqi.formula.js';
import { computeSharedFarmPenalty } from '../formulas/shared-farm.penalty.js';

export interface AudienceQualityReport {
  actorId: string;
  windowDays: number;
  totalFollowers: number;
  sampledFollowers: number;
  pctHuman: number;
  pctSuspicious: number;
  pctBot: number;
  pctActive: number;
  pctDormant: number;
  pctDead: number;
  aqi: number;
  level: AQILevel;
  reasons: string[];
  updatedAt: string;
}

export class AudienceQualityService {
  private followerNodes: Collection<Document>;
  private audienceReports: Collection<Document>;
  private botFarms: Collection<Document>;

  constructor(private db: Db) {
    this.followerNodes = db.collection('follower_nodes');
    this.audienceReports = db.collection('audience_quality_reports');
    this.botFarms = db.collection('bot_farms');
  }

  /**
   * Compute and cache AQI report for an actor
   */
  async computeAndUpsert(
    actorId: string,
    opts?: { sampleLimit?: number; windowDays?: number }
  ): Promise<AudienceQualityReport> {
    const sampleLimit = opts?.sampleLimit ?? 1500;
    const windowDays = opts?.windowDays ?? 30;

    // Aggregate follower stats
    const agg = await this.aggregateAudienceQuality(actorId, sampleLimit);

    // Get farm penalty
    const farms = await this.botFarms.find({ actorIds: actorId }).limit(50).toArray();
    const sharedFarmPenalty = computeSharedFarmPenalty({
      sharedFarms: farms.map((x: any) => ({
        sharedFollowers: x.sharedFollowers ?? 0,
        confidence: x.confidence ?? 0.5
      }))
    });

    // Calculate AQI
    const { aqi, level } = computeAqi({
      pctHuman: agg.pctHuman,
      pctSuspicious: agg.pctSuspicious,
      pctBot: agg.pctBot,
      pctActive: agg.pctActive,
      pctDead: agg.pctDead,
      sharedFarmPenalty
    });

    // Build reasons
    const reasons = [
      ...agg.reasonsBase,
      ...(sharedFarmPenalty > 6 ? [`Shared bot farms penalty (-${sharedFarmPenalty})`] : [])
    ].slice(0, 6);

    const report: AudienceQualityReport = {
      actorId,
      windowDays,
      totalFollowers: agg.totalFollowers,
      sampledFollowers: agg.sampledFollowers,
      pctHuman: agg.pctHuman,
      pctSuspicious: agg.pctSuspicious,
      pctBot: agg.pctBot,
      pctActive: agg.pctActive,
      pctDormant: agg.pctDormant,
      pctDead: agg.pctDead,
      aqi,
      level,
      reasons,
      updatedAt: new Date().toISOString()
    };

    // Cache report
    await this.audienceReports.updateOne(
      { actorId },
      { $set: report },
      { upsert: true }
    );

    return report;
  }

  /**
   * Get cached report
   */
  async get(actorId: string): Promise<AudienceQualityReport | null> {
    const doc = await this.audienceReports.findOne({ actorId });
    return doc as unknown as AudienceQualityReport | null;
  }

  /**
   * Aggregate follower quality stats
   */
  private async aggregateAudienceQuality(actorId: string, sampleLimit: number) {
    // Count total followers
    const totalAgg = await this.followerNodes.aggregate([
      { $match: { actorId } },
      { $group: { _id: '$followerId' } },
      { $count: 'cnt' }
    ]).toArray();

    const totalFollowers = totalAgg[0]?.cnt ?? 0;

    // Sample and classify
    const rows = await this.followerNodes.aggregate([
      { $match: { actorId } },
      { $limit: sampleLimit },
      {
        $group: {
          _id: null,
          sampledFollowers: { $addToSet: '$followerId' },
          human: { $sum: { $cond: [{ $eq: ['$label', 'REAL'] }, 1, 0] } },
          suspicious: { $sum: { $cond: [{ $eq: ['$label', 'SUSPICIOUS'] }, 1, 0] } },
          bot: { $sum: { $cond: [{ $in: ['$label', ['BOT', 'BOT_LIKELY', 'FARM_NODE']] }, 1, 0] } },
          active: { $sum: { $cond: [{ $eq: ['$activity', 'ACTIVE'] }, 1, 0] } },
          dormant: { $sum: { $cond: [{ $eq: ['$activity', 'DORMANT'] }, 1, 0] } },
          dead: { $sum: { $cond: [{ $eq: ['$activity', 'DEAD'] }, 1, 0] } }
        }
      },
      {
        $project: {
          sampledFollowers: { $size: '$sampledFollowers' },
          human: 1, suspicious: 1, bot: 1,
          active: 1, dormant: 1, dead: 1
        }
      }
    ]).toArray();

    const r = rows[0] ?? {
      sampledFollowers: 0,
      human: 0, suspicious: 0, bot: 0,
      active: 0, dormant: 0, dead: 0
    };

    const denom = Math.max(1, r.sampledFollowers);

    const pctHuman = (r.human / denom) * 100;
    const pctSuspicious = (r.suspicious / denom) * 100;
    const pctBot = (r.bot / denom) * 100;
    const pctActive = (r.active / denom) * 100;
    const pctDormant = (r.dormant / denom) * 100;
    const pctDead = (r.dead / denom) * 100;

    const reasonsBase: string[] = [];
    if (pctBot > 25) reasonsBase.push(`High bot share (${pctBot.toFixed(1)}%)`);
    if (pctDead > 50) reasonsBase.push(`Audience mostly inactive (${pctDead.toFixed(1)}% dead)`);
    if (pctHuman > 70) reasonsBase.push(`Strong human audience (${pctHuman.toFixed(1)}%)`);

    return {
      totalFollowers,
      sampledFollowers: r.sampledFollowers,
      pctHuman: Math.round(pctHuman * 10) / 10,
      pctSuspicious: Math.round(pctSuspicious * 10) / 10,
      pctBot: Math.round(pctBot * 10) / 10,
      pctActive: Math.round(pctActive * 10) / 10,
      pctDormant: Math.round(pctDormant * 10) / 10,
      pctDead: Math.round(pctDead * 10) / 10,
      reasonsBase
    };
  }
}
