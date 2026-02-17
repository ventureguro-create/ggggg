/**
 * Influence History Store
 * 
 * Tracks history of on-chain verdicts per actor.
 */

import { Db, Collection } from 'mongodb';
import { InfluenceHistoryEntry } from '../contracts/influence-adjustment.types.js';

export class InfluenceHistoryStore {
  private col: Collection<InfluenceHistoryEntry>;

  constructor(db: Db) {
    this.col = db.collection<InfluenceHistoryEntry>('connections_influence_history');
    this.col.createIndex({ actorId: 1, evaluatedAt: -1 }).catch(() => {});
  }

  async add(entry: InfluenceHistoryEntry): Promise<void> {
    await this.col.insertOne(entry);
  }

  async addFromLedger(ledgerEntry: {
    actorId?: string;
    eventId: string;
    onchain: { verdict: string; confidence_0_1: number };
    evaluatedAt: string;
  }): Promise<void> {
    if (!ledgerEntry.actorId) return;
    
    await this.add({
      actorId: ledgerEntry.actorId,
      eventId: ledgerEntry.eventId,
      verdict: ledgerEntry.onchain.verdict as any,
      evaluatedAt: ledgerEntry.evaluatedAt,
      confidence_0_1: ledgerEntry.onchain.confidence_0_1,
    });
  }

  async last(actorId: string, limit = 20): Promise<InfluenceHistoryEntry[]> {
    return this.col
      .find({ actorId })
      .sort({ evaluatedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getStats(actorId: string): Promise<{ total: number; confirmed: number; contradicted: number; noData: number }> {
    const events = await this.last(actorId, 100);
    return {
      total: events.length,
      confirmed: events.filter(e => e.verdict === 'CONFIRMED').length,
      contradicted: events.filter(e => e.verdict === 'CONTRADICTED').length,
      noData: events.filter(e => e.verdict === 'NO_DATA').length,
    };
  }
}
