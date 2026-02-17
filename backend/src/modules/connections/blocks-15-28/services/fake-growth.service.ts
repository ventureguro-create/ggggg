/**
 * BLOCK 17 - Fake Growth Detector Service
 * 
 * Detects manipulation through growth patterns
 */

import type { Db, Collection, Document } from 'mongodb';
import { computeGrowthScore, buildGrowthReasons, type GrowthLabel } from '../formulas/fake-growth.formula.js';

export interface FakeGrowthReport {
  actorId: string;
  windowDays: number;
  avgDailyGrowth: number;
  maxSpike: number;
  churnRate: number;
  deadGrowthRate: number;
  followRingScore: number;
  growthScore: number;
  label: GrowthLabel;
  reasons: string[];
  updatedAt: string;
}

export class FakeGrowthService {
  private snapshots: Collection<Document>;
  private reports: Collection<Document>;
  private followGraph: Collection<Document>;

  constructor(private db: Db) {
    this.snapshots = db.collection('growth_snapshots');
    this.reports = db.collection('fake_growth_reports');
    this.followGraph = db.collection('follow_graph');
  }

  /**
   * Compute fake growth report for an actor
   */
  async compute(actorId: string, windowDays = 30): Promise<FakeGrowthReport | null> {
    const agg = await this.aggregateGrowth(actorId, windowDays);
    if (!agg) return null;

    const spikeRatio = agg.maxSpike / Math.max(1, agg.avgDailyGrowth);
    const churnRate = await this.computeChurnRate(actorId, windowDays);
    const followRingScore = await this.computeFollowRingScore(actorId);

    const { score, label } = computeGrowthScore({
      spikeRatio,
      churnRate,
      deadGrowthRate: agg.deadGrowthRate,
      followRingScore
    });

    const reasons = buildGrowthReasons(score, spikeRatio, churnRate, agg.deadGrowthRate);

    const report: FakeGrowthReport = {
      actorId,
      windowDays,
      avgDailyGrowth: Math.round(agg.avgDailyGrowth * 10) / 10,
      maxSpike: agg.maxSpike,
      churnRate: Math.round(churnRate * 100) / 100,
      deadGrowthRate: Math.round(agg.deadGrowthRate * 100) / 100,
      followRingScore: Math.round(followRingScore * 100) / 100,
      growthScore: score,
      label,
      reasons,
      updatedAt: new Date().toISOString()
    };

    // Cache report
    await this.reports.updateOne(
      { actorId },
      { $set: report },
      { upsert: true }
    );

    return report;
  }

  /**
   * Get cached report
   */
  async get(actorId: string): Promise<FakeGrowthReport | null> {
    const doc = await this.reports.findOne({ actorId });
    return doc as unknown as FakeGrowthReport | null;
  }

  /**
   * Aggregate growth data
   */
  private async aggregateGrowth(actorId: string, windowDays: number) {
    const since = new Date(Date.now() - windowDays * 86400000);

    const rows = await this.snapshots.aggregate([
      { $match: { actorId, ts: { $gte: since } } },
      { $sort: { ts: 1 } },
      {
        $group: {
          _id: null,
          days: { $sum: 1 },
          totalGrowth: { $sum: '$deltaFollowers' },
          maxSpike: { $max: '$deltaFollowers' },
          growthDays: {
            $sum: { $cond: [{ $gt: ['$deltaFollowers', 0] }, 1, 0] }
          },
          deadGrowthDays: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$deltaFollowers', 0] },
                    { $lt: [{ $ifNull: ['$likes', 0] }, 2] },
                    { $lt: [{ $ifNull: ['$replies', 0] }, 1] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]).toArray();

    const r = rows[0];
    if (!r) return null;

    return {
      avgDailyGrowth: r.totalGrowth / Math.max(1, r.days),
      maxSpike: r.maxSpike || 0,
      deadGrowthRate: r.deadGrowthDays / Math.max(1, r.growthDays)
    };
  }

  /**
   * Compute churn rate (unfollows / follows)
   */
  private async computeChurnRate(actorId: string, windowDays: number): Promise<number> {
    const since = new Date(Date.now() - windowDays * 86400000);

    const stats = await this.snapshots.aggregate([
      { $match: { actorId, ts: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalFollows: { $sum: { $cond: [{ $gt: ['$deltaFollowers', 0] }, '$deltaFollowers', 0] } },
          totalUnfollows: { $sum: { $cond: [{ $lt: ['$deltaFollowers', 0] }, { $abs: '$deltaFollowers' }, 0] } }
        }
      }
    ]).toArray();

    if (!stats.length || !stats[0].totalFollows) return 0;
    return stats[0].totalUnfollows / stats[0].totalFollows;
  }

  /**
   * Compute follow ring score (mutual follows)
   */
  private async computeFollowRingScore(actorId: string): Promise<number> {
    // Simplified - would need follow graph data
    const recentFollowers = await this.followGraph.countDocuments({
      followedId: actorId,
      createdAt: { $gte: new Date(Date.now() - 7 * 86400000) }
    });

    const mutualFollows = await this.followGraph.countDocuments({
      followerId: actorId,
      mutual: true,
      createdAt: { $gte: new Date(Date.now() - 7 * 86400000) }
    });

    if (!recentFollowers) return 0;
    return mutualFollows / recentFollowers;
  }
}
