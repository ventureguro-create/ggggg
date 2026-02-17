/**
 * Reality Gate Audit Store
 * 
 * Records all gate decisions for audit trail
 */

import { Db, Collection } from 'mongodb';
import { RealityGateResult } from '../contracts/reality-gate.types.js';

export class RealityGateAuditStore {
  private col: Collection<RealityGateResult & { _id?: string }>;

  constructor(db: Db) {
    this.col = db.collection('connections_reality_gate_audit');
    this.col.createIndex({ eventId: 1 }).catch(() => {});
    this.col.createIndex({ 'trustAdjustment.actorId': 1, evaluatedAt: -1 }).catch(() => {});
    this.col.createIndex({ decision: 1, evaluatedAt: -1 }).catch(() => {});
  }

  async record(result: RealityGateResult): Promise<void> {
    await this.col.insertOne(result);
  }

  async getByEvent(eventId: string): Promise<RealityGateResult | null> {
    return this.col.findOne({ eventId });
  }

  async listByActor(actorId: string, limit = 50): Promise<RealityGateResult[]> {
    return this.col
      .find({ 'trustAdjustment.actorId': actorId })
      .sort({ evaluatedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async listByDecision(decision: string, limit = 50): Promise<RealityGateResult[]> {
    return this.col
      .find({ decision })
      .sort({ evaluatedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getStats(): Promise<{
    total: number;
    byDecision: Record<string, number>;
    last24h: { total: number; blocked: number; sent: number };
  }> {
    const total = await this.col.countDocuments();
    
    const byDecisionPipeline = [
      { $group: { _id: '$decision', count: { $sum: 1 } } },
    ];
    const byDecisionResults = await this.col.aggregate(byDecisionPipeline).toArray();
    const byDecision: Record<string, number> = {};
    for (const r of byDecisionResults) {
      byDecision[r._id] = r.count;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const last24h = await this.col.aggregate([
      { $match: { evaluatedAt: { $gte: yesterday.toISOString() } } },
      { $group: { 
          _id: null, 
          total: { $sum: 1 },
          blocked: { $sum: { $cond: [{ $eq: ['$decision', 'BLOCK'] }, 1, 0] } },
          sent: { $sum: { $cond: [{ $in: ['$decision', ['SEND', 'SEND_HIGH', 'SEND_LOW']] }, 1, 0] } },
        } 
      },
    ]).toArray();

    return {
      total,
      byDecision,
      last24h: last24h[0] || { total: 0, blocked: 0, sent: 0 },
    };
  }
}
