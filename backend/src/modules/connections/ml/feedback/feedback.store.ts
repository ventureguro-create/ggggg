/**
 * Feedback Store (Phase 5.3)
 * 
 * MongoDB-backed storage for alert feedback and ML training data.
 */

import type { Collection, Db } from 'mongodb';
import type { AlertFeedback, FeedbackLabel, FeedbackStats, FeedbackSource } from './feedback.types.js';

export class FeedbackStore {
  private col: Collection<AlertFeedback>;
  
  constructor(db: Db) {
    this.col = db.collection<AlertFeedback>('connections_alert_feedback');
    this.ensureIndexes();
  }
  
  private async ensureIndexes(): Promise<void> {
    await this.col.createIndex({ alert_id: 1 }, { unique: true, background: true });
    await this.col.createIndex({ feedback_timestamp: -1 }, { background: true });
    await this.col.createIndex({ feedback: 1 }, { background: true });
    await this.col.createIndex({ account_id: 1 }, { background: true });
    await this.col.createIndex({ alert_type: 1, feedback: 1 }, { background: true });
  }
  
  /**
   * Record alert for future feedback (called when alert is sent)
   */
  async recordAlert(data: Omit<AlertFeedback, 'feedback' | 'feedback_timestamp' | 'feedback_source'>): Promise<void> {
    const doc: AlertFeedback = {
      ...data,
      feedback: 'UNKNOWN',
      feedback_source: 'SYSTEM',
    };
    
    await this.col.updateOne(
      { alert_id: data.alert_id },
      { $set: doc },
      { upsert: true }
    );
  }
  
  /**
   * Add feedback to existing alert
   */
  async addFeedback(
    alertId: string,
    feedback: FeedbackLabel,
    source: FeedbackSource,
    feedbackBy?: string,
    note?: string
  ): Promise<AlertFeedback | null> {
    const result = await this.col.findOneAndUpdate(
      { alert_id: alertId },
      {
        $set: {
          feedback,
          feedback_source: source,
          feedback_by: feedbackBy,
          feedback_note: note,
          feedback_timestamp: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' }
    );
    
    return result as AlertFeedback | null;
  }
  
  /**
   * Get feedback stats
   */
  async getStats(since?: string): Promise<FeedbackStats> {
    const match: any = {};
    if (since) match.alert_timestamp = { $gte: since };
    
    // Total counts by feedback
    const countsPipeline = [
      { $match: match },
      { $group: { _id: '$feedback', count: { $sum: 1 } } },
    ];
    const counts = await this.col.aggregate(countsPipeline).toArray();
    
    let total = 0, correct = 0, fp = 0, noise = 0, tooEarly = 0, unknown = 0;
    for (const c of counts) {
      total += c.count;
      if (c._id === 'CORRECT') correct = c.count;
      if (c._id === 'FALSE_POSITIVE') fp = c.count;
      if (c._id === 'NOISE') noise = c.count;
      if (c._id === 'TOO_EARLY') tooEarly = c.count;
      if (c._id === 'UNKNOWN') unknown = c.count;
    }
    
    // By alert type
    const byTypePipeline = [
      { $match: { ...match, feedback: { $ne: 'UNKNOWN' } } },
      {
        $group: {
          _id: { type: '$alert_type', feedback: '$feedback' },
          count: { $sum: 1 },
        },
      },
    ];
    const byTypeRaw = await this.col.aggregate(byTypePipeline).toArray();
    
    const byAlertType: Record<string, { total: number; fp: number; fp_rate: number }> = {};
    for (const r of byTypeRaw) {
      const type = r._id.type;
      if (!byAlertType[type]) byAlertType[type] = { total: 0, fp: 0, fp_rate: 0 };
      byAlertType[type].total += r.count;
      if (r._id.feedback === 'FALSE_POSITIVE') byAlertType[type].fp += r.count;
    }
    for (const type of Object.keys(byAlertType)) {
      byAlertType[type].fp_rate = byAlertType[type].total > 0 
        ? (byAlertType[type].fp / byAlertType[type].total) * 100 
        : 0;
    }
    
    // By pattern
    const byPatternPipeline = [
      { $match: { ...match, feedback: { $ne: 'UNKNOWN' }, patterns: { $ne: [] } } },
      { $unwind: '$patterns' },
      {
        $group: {
          _id: { pattern: '$patterns', feedback: '$feedback' },
          count: { $sum: 1 },
        },
      },
    ];
    const byPatternRaw = await this.col.aggregate(byPatternPipeline).toArray();
    
    const byPattern: Record<string, { total: number; fp: number; fp_rate: number }> = {};
    for (const r of byPatternRaw) {
      const pattern = r._id.pattern;
      if (!byPattern[pattern]) byPattern[pattern] = { total: 0, fp: 0, fp_rate: 0 };
      byPattern[pattern].total += r.count;
      if (r._id.feedback === 'FALSE_POSITIVE') byPattern[pattern].fp += r.count;
    }
    for (const p of Object.keys(byPattern)) {
      byPattern[p].fp_rate = byPattern[p].total > 0 
        ? (byPattern[p].fp / byPattern[p].total) * 100 
        : 0;
    }
    
    const labeled = total - unknown;
    const fpRate = labeled > 0 ? (fp / labeled) * 100 : 0;
    
    return {
      total,
      correct,
      false_positive: fp,
      noise,
      too_early: tooEarly,
      unknown,
      fp_rate: Math.round(fpRate * 10) / 10,
      by_alert_type: byAlertType,
      by_pattern: byPattern,
    };
  }
  
  /**
   * Get training dataset (labeled feedback only)
   */
  async getTrainingData(limit: number = 1000): Promise<AlertFeedback[]> {
    return await this.col
      .find({ feedback: { $ne: 'UNKNOWN' } })
      .sort({ feedback_timestamp: -1 })
      .limit(limit)
      .toArray();
  }
  
  /**
   * Get recent alerts for feedback
   */
  async getRecentAlerts(limit: number = 50): Promise<AlertFeedback[]> {
    return await this.col
      .find({})
      .sort({ alert_timestamp: -1 })
      .limit(limit)
      .toArray();
  }
  
  /**
   * Get alerts needing feedback
   */
  async getAlertsNeedingFeedback(limit: number = 20): Promise<AlertFeedback[]> {
    return await this.col
      .find({ feedback: 'UNKNOWN' })
      .sort({ alert_timestamp: -1 })
      .limit(limit)
      .toArray();
  }
  
  /**
   * Get feedback by account
   */
  async getByAccount(accountId: string): Promise<AlertFeedback[]> {
    return await this.col
      .find({ account_id: accountId })
      .sort({ alert_timestamp: -1 })
      .toArray();
  }
}

// Singleton
let storeInstance: FeedbackStore | null = null;

export function initFeedbackStore(db: Db): FeedbackStore {
  if (!storeInstance) {
    storeInstance = new FeedbackStore(db);
    console.log('[Feedback] Store initialized');
  }
  return storeInstance;
}

export function getFeedbackStore(): FeedbackStore {
  if (!storeInstance) {
    throw new Error('FeedbackStore not initialized');
  }
  return storeInstance;
}
