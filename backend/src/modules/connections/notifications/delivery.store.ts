/**
 * Connections Telegram Delivery Store
 * Phase 2.3: MongoDB storage for sent/delivered alerts
 * 
 * Tracks delivery history for cooldown and analytics
 */

import type { Db, Collection } from 'mongodb';
import type { ConnectionsAlertEvent, ConnectionsAlertType, AlertDeliveryStatus } from './types.js';

const COLLECTION_NAME = 'connections_telegram_delivery';

export class ConnectionsTelegramDeliveryStore {
  private collection: Collection;

  constructor(db: Db) {
    this.collection = db.collection(COLLECTION_NAME);
    // Create indexes
    this.collection.createIndex({ account_id: 1, type: 1, sent_at: -1 });
    this.collection.createIndex({ delivery_status: 1 });
    this.collection.createIndex({ created_at: -1 });
  }

  /**
   * Record a delivery attempt
   */
  async record(event: ConnectionsAlertEvent): Promise<void> {
    await this.collection.insertOne({
      ...event,
      recorded_at: new Date().toISOString(),
    });
  }

  /**
   * Get last sent alert for account+type (for cooldown check)
   */
  async getLastSent(
    accountId: string,
    type: ConnectionsAlertType
  ): Promise<ConnectionsAlertEvent | null> {
    const result = await this.collection.findOne(
      {
        account_id: accountId,
        type,
        delivery_status: 'SENT',
      },
      { sort: { sent_at: -1 } }
    );
    
    if (!result) return null;
    const { _id, ...rest } = result as any;
    return rest as ConnectionsAlertEvent;
  }

  /**
   * Get recent deliveries (for Admin UI)
   */
  async getRecent(opts?: {
    limit?: number;
    type?: ConnectionsAlertType;
    status?: AlertDeliveryStatus;
  }): Promise<ConnectionsAlertEvent[]> {
    const query: any = {};
    if (opts?.type) query.type = opts.type;
    if (opts?.status) query.delivery_status = opts.status;

    const cursor = this.collection
      .find(query)
      .sort({ created_at: -1 })
      .limit(opts?.limit || 50);

    const results = await cursor.toArray();
    return results.map((doc: any) => {
      const { _id, ...rest } = doc;
      return rest as ConnectionsAlertEvent;
    });
  }

  /**
   * Get delivery stats (for Admin UI)
   */
  async getStats(sinceHours: number = 24): Promise<{
    total: number;
    sent: number;
    skipped: number;
    failed: number;
    by_type: Record<ConnectionsAlertType, number>;
  }> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
    
    const docs = await this.collection.find({ created_at: { $gte: since } }).toArray();
    
    const stats = {
      total: docs.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      by_type: {
        EARLY_BREAKOUT: 0,
        STRONG_ACCELERATION: 0,
        TREND_REVERSAL: 0,
        TEST: 0,
      } as Record<ConnectionsAlertType, number>,
    };

    for (const doc of docs) {
      if (doc.delivery_status === 'SENT') stats.sent++;
      if (doc.delivery_status === 'SKIPPED') stats.skipped++;
      if (doc.delivery_status === 'FAILED') stats.failed++;
      if (doc.type && stats.by_type[doc.type as ConnectionsAlertType] !== undefined) {
        stats.by_type[doc.type as ConnectionsAlertType]++;
      }
    }

    return stats;
  }
}
