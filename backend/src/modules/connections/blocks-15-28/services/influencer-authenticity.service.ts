/**
 * BLOCK 21 - Influencer Authenticity Service
 * 
 * Calculates IAS (Influencer Authenticity Score)
 */

import type { Db, Collection, Document } from 'mongodb';
import { influencerAuthenticityScore, authenticityLabel, type AuthenticityLabel } from '../formulas/authenticity.score.js';

export interface InfluencerAuthenticityReport {
  actorId: string;
  score: number;
  label: AuthenticityLabel;
  breakdown: {
    realFollowerRatio: number;
    audienceQuality: number;
    networkIntegrity: number;
  };
  updatedAt: string;
}

export class InfluencerAuthenticityService {
  private actorFollowersEnriched: Collection<Document>;
  private farmOverlapEdges: Collection<Document>;
  private audienceQualityReports: Collection<Document>;
  private reports: Collection<Document>;

  constructor(private db: Db) {
    this.actorFollowersEnriched = db.collection('actor_followers_enriched');
    this.farmOverlapEdges = db.collection('farm_overlap_edges');
    this.audienceQualityReports = db.collection('audience_quality_reports');
    this.reports = db.collection('influencer_authenticity_reports');
  }

  /**
   * Compute authenticity score for an actor
   */
  async compute(actorId: string): Promise<InfluencerAuthenticityReport> {
    // Get AQI report
    const aqiReport = await this.audienceQualityReports.findOne({ actorId });
    const pctHuman = aqiReport?.pctHuman ?? 50;
    const pctBot = aqiReport?.pctBot ?? 20;

    // Calculate realFollowerRatio (% non-bot, non-farm)
    const realFollowerRatio = Math.max(0, Math.min(100, pctHuman + (100 - pctHuman - pctBot) * 0.5));

    // Get audience quality from AQI
    const audienceQuality = aqiReport?.aqi ?? 50;

    // Calculate network integrity (inverse of overlap)
    const overlaps = await this.farmOverlapEdges.aggregate([
      { $match: { $or: [{ a: actorId }, { b: actorId }] } },
      { $group: { _id: null, avgOverlap: { $avg: '$overlapScore' } } }
    ]).toArray();

    const avgOverlap = overlaps[0]?.avgOverlap ?? 0;
    const networkIntegrity = Math.max(0, 100 - avgOverlap * 100);

    // Calculate IAS
    const score = influencerAuthenticityScore({
      realFollowerRatio,
      audienceQuality,
      networkIntegrity
    });

    const report: InfluencerAuthenticityReport = {
      actorId,
      score,
      label: authenticityLabel(score),
      breakdown: {
        realFollowerRatio: Math.round(realFollowerRatio * 10) / 10,
        audienceQuality: Math.round(audienceQuality * 10) / 10,
        networkIntegrity: Math.round(networkIntegrity * 10) / 10
      },
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
  async get(actorId: string): Promise<InfluencerAuthenticityReport | null> {
    const doc = await this.reports.findOne({ actorId });
    return doc as unknown as InfluencerAuthenticityReport | null;
  }
}
