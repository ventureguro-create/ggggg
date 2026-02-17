/**
 * BLOCK 24 - Alert Gate Service
 * 
 * Final protection layer before sending alerts to users
 */

import type { Db, Collection, Document } from 'mongodb';
import { applyAuthenticityGate, type AlertGateInput, type AlertGateOutput, type AlertDecision } from '../formulas/alert-gate.js';

export interface AlertDecisionLog {
  alertId: string;
  authenticity: number;
  bms: number;
  decision: AlertDecision;
  flags: string[];
  confidenceAfter: number;
  reason?: string;
  timestamp: string;
}

export class AlertGateService {
  private authenticityReports: Collection<Document>;
  private bmsReports: Collection<Document>;
  private decisionLog: Collection<Document>;

  constructor(private db: Db) {
    this.authenticityReports = db.collection('influencer_authenticity_reports');
    this.bmsReports = db.collection('bot_market_signals');
    this.decisionLog = db.collection('alert_decision_log');
  }

  /**
   * Process an alert through the authenticity gate
   */
  async processAlert(actorId: string, alert: AlertGateInput): Promise<AlertGateOutput> {
    // Get authenticity score
    const authReport = await this.authenticityReports.findOne({ actorId });
    const authenticity = (authReport?.score ?? 50) / 100; // Normalize to 0-1

    // Get BMS
    const bmsReport = await this.bmsReports.findOne({ actorId, window: '24h' });
    const bms = bmsReport?.bms ?? 0;

    // Apply gate
    const result = applyAuthenticityGate(alert, { authenticity, bms });

    // Log decision
    const log: AlertDecisionLog = {
      alertId: alert.alertId,
      authenticity,
      bms,
      decision: result.decision,
      flags: result.flags || [],
      confidenceAfter: result.confidence,
      reason: result.reason,
      timestamp: new Date().toISOString()
    };

    await this.decisionLog.insertOne(log);

    return result;
  }

  /**
   * Get decision log for an alert
   */
  async getDecisionLog(alertId: string): Promise<AlertDecisionLog | null> {
    const doc = await this.decisionLog.findOne({ alertId });
    return doc as unknown as AlertDecisionLog | null;
  }

  /**
   * Get recent decisions
   */
  async getRecentDecisions(limit = 50): Promise<AlertDecisionLog[]> {
    const docs = await this.decisionLog
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return docs as unknown as AlertDecisionLog[];
  }
}
