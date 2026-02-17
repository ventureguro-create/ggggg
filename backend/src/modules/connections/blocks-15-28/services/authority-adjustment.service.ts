/**
 * BLOCK 22 - Authority Adjustment Service
 * 
 * Adjusts authority based on authenticity score
 */

import type { Db, Collection, Document } from 'mongodb';
import { authenticityAuthorityModifier, type AuthorityAdjustmentResult } from '../formulas/authority-adjustment.js';

export interface AuthorityAdjustmentReport extends AuthorityAdjustmentResult {
  actorId: string;
  updatedAt: string;
}

export class AuthorityAdjustmentService {
  private authenticityReports: Collection<Document>;
  private authorityReports: Collection<Document>;
  private actorScores: Collection<Document>;

  constructor(private db: Db) {
    this.authenticityReports = db.collection('influencer_authenticity_reports');
    this.authorityReports = db.collection('authority_adjustment_reports');
    this.actorScores = db.collection('actor_scores');
  }

  /**
   * Get adjusted authority for an actor
   */
  async getAdjustedAuthority(actorId: string): Promise<AuthorityAdjustmentReport> {
    // Get base authority
    const actorScore = await this.actorScores.findOne({ actorId });
    const baseAuthority = actorScore?.authority ?? actorScore?.influence ?? 50;

    // Get authenticity score
    const authReport = await this.authenticityReports.findOne({ actorId });
    const authenticityScore = authReport?.score ?? 50;

    // Calculate adjustment
    const adjustment = authenticityAuthorityModifier(baseAuthority, authenticityScore);

    const report: AuthorityAdjustmentReport = {
      actorId,
      ...adjustment,
      updatedAt: new Date().toISOString()
    };

    // Cache
    await this.authorityReports.updateOne(
      { actorId },
      { $set: report },
      { upsert: true }
    );

    return report;
  }

  /**
   * Apply adjustment to all actors
   */
  async applyToAll(limit = 100): Promise<{ processed: number }> {
    const actors = await this.actorScores
      .find({})
      .limit(limit)
      .toArray();

    for (const actor of actors) {
      await this.getAdjustedAuthority(actor.actorId);
    }

    return { processed: actors.length };
  }
}
