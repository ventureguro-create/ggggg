/**
 * BLOCK 27 - Actor Behavior Profile Service
 * 
 * Classifies actors by historical behavior patterns
 */

import type { Db, Collection, Document } from 'mongodb';
import { classifyActor, getProfileDescription, type ActorProfileType, type BehaviorVector } from '../formulas/actor-profile.classifier.js';

export interface ActorBehaviorProfileReport {
  actorId: string;
  profile: ActorProfileType;
  confidence: number;
  description: string;
  since: string;
  metrics: BehaviorVector;
  updatedAt: string;
}

export class ActorBehaviorProfileService {
  private actorEvents: Collection<Document>;
  private walletClusters: Collection<Document>;
  private realityVerifications: Collection<Document>;
  private profiles: Collection<Document>;

  constructor(private db: Db) {
    this.actorEvents = db.collection('actor_events');
    this.walletClusters = db.collection('wallet_actor_clusters');
    this.realityVerifications = db.collection('reality_verifications');
    this.profiles = db.collection('actor_behavior_profiles');
  }

  /**
   * Compute behavior profile for an actor
   */
  async compute(actorId: string, windowDays = 90): Promise<ActorBehaviorProfileReport> {
    const since = new Date(Date.now() - windowDays * 86400000);

    // Calculate behavior metrics
    const metrics = await this.calculateBehaviorMetrics(actorId, since);

    // Classify
    const profile = classifyActor(metrics);
    const description = getProfileDescription(profile);

    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(metrics);

    const report: ActorBehaviorProfileReport = {
      actorId,
      profile,
      confidence: Math.round(confidence * 100) / 100,
      description,
      since: since.toISOString(),
      metrics,
      updatedAt: new Date().toISOString()
    };

    // Cache
    await this.profiles.updateOne(
      { actorId },
      { $set: report },
      { upsert: true }
    );

    return report;
  }

  /**
   * Get cached profile
   */
  async get(actorId: string): Promise<ActorBehaviorProfileReport | null> {
    const doc = await this.profiles.findOne({ actorId });
    return doc as unknown as ActorBehaviorProfileReport | null;
  }

  /**
   * Get actors by profile type
   */
  async getByProfileType(
    profileType: ActorProfileType,
    limit = 50
  ): Promise<ActorBehaviorProfileReport[]> {
    const docs = await this.profiles
      .find({ profile: profileType })
      .sort({ confidence: -1 })
      .limit(limit)
      .toArray();

    return docs as unknown as ActorBehaviorProfileReport[];
  }

  /**
   * Calculate behavior metrics
   */
  private async calculateBehaviorMetrics(actorId: string, since: Date): Promise<BehaviorVector> {
    // Get actor events (tweets, mentions)
    const events = await this.actorEvents
      .find({ actorId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .toArray();

    // Get reality verifications
    const verifications = await this.realityVerifications
      .find({ actorId, timestamp: { $gte: since } })
      .toArray();

    // Get wallet activity
    const walletActivity = await this.walletClusters
      .find({ members: actorId })
      .toArray();

    // Calculate accumulation bias
    let inflows = 0;
    let outflows = 0;
    for (const wa of walletActivity) {
      if (wa.behavior === 'ACCUMULATION') inflows++;
      else if (wa.behavior === 'DISTRIBUTION') outflows++;
    }
    const accumulationBias = inflows + outflows > 0
      ? inflows / (inflows + outflows)
      : 0.5;

    // Calculate tweet lead/lag
    let totalLag = 0;
    let lagCount = 0;
    for (const e of events) {
      const matchingVerification = verifications.find(v =>
        Math.abs(new Date(v.timestamp).getTime() - new Date(e.timestamp).getTime()) < 24 * 3600000
      );
      if (matchingVerification) {
        const lag = (new Date(matchingVerification.timestamp).getTime() - new Date(e.timestamp).getTime()) / 3600000;
        totalLag += lag;
        lagCount++;
      }
    }
    const tweetLeadLag = lagCount > 0 ? totalLag / lagCount : 0;

    // Calculate distribution after mentions
    const confirmedCount = verifications.filter(v => v.verdict === 'CONFIRMED').length;
    const contradictedCount = verifications.filter(v => v.verdict === 'CONTRADICTED').length;
    const distributionAfterMentions = contradictedCount + confirmedCount > 0
      ? contradictedCount / (contradictedCount + confirmedCount)
      : 0;

    // Calculate holding duration (simplified)
    const holdingDuration = walletActivity.length > 0 ? 45 : 0; // Placeholder

    // Calculate confirmation ratio
    const confirmationRatio = confirmedCount + contradictedCount > 0
      ? confirmedCount / (confirmedCount + contradictedCount)
      : 0.5;

    // Calculate directional variance
    const directions = walletActivity.map(w => w.behavior);
    const uniqueDirections = new Set(directions);
    const directionalVariance = uniqueDirections.size / Math.max(1, directions.length);

    return {
      accumulationBias,
      tweetLeadLag,
      distributionAfterMentions,
      holdingDuration,
      confirmationRatio,
      directionalVariance
    };
  }

  /**
   * Calculate confidence based on data availability
   */
  private calculateConfidence(metrics: BehaviorVector): number {
    let confidence = 0.5;

    // More data = higher confidence
    if (metrics.confirmationRatio > 0 && metrics.confirmationRatio < 1) confidence += 0.2;
    if (metrics.holdingDuration > 0) confidence += 0.1;
    if (metrics.tweetLeadLag !== 0) confidence += 0.1;
    if (metrics.accumulationBias !== 0.5) confidence += 0.1;

    return Math.min(1, confidence);
  }
}
