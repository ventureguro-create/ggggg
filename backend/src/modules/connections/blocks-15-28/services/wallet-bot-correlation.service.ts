/**
 * BLOCK 25 - Wallet Bot Correlation Service
 * 
 * Links Twitter manipulation with on-chain money movement
 */

import type { Db, Collection, Document } from 'mongodb';
import { correlateBotAndOnchain, type CorrelationLabel } from '../formulas/wallet-bot-correlation.js';

export interface ManipulationCorrelationReport {
  asset: string;
  actorId?: string;
  bms: number;
  onchainFlow: number;
  onchainIntensity: number;
  timeDeltaHours: number;
  correlation: number;
  label: CorrelationLabel;
  window: string;
  timestamp: string;
}

export class WalletBotCorrelationService {
  private bmsReports: Collection<Document>;
  private onchainFlows: Collection<Document>;
  private correlationLog: Collection<Document>;

  constructor(private db: Db) {
    this.bmsReports = db.collection('bot_market_signals');
    this.onchainFlows = db.collection('onchain_flows');
    this.correlationLog = db.collection('manipulation_correlation_log');
  }

  /**
   * Correlate bot activity with on-chain flow for an asset
   */
  async correlate(params: {
    asset: string;
    actorId?: string;
    twitterEventTime: Date;
  }): Promise<ManipulationCorrelationReport> {
    const { asset, actorId, twitterEventTime } = params;

    // Get BMS if actor provided
    let bms = 0;
    if (actorId) {
      const bmsReport = await this.bmsReports.findOne({ actorId, window: '24h' });
      bms = bmsReport?.bms ?? 0;
    }

    // Get on-chain flow around the event time
    const windowStart = new Date(twitterEventTime.getTime() - 6 * 3600000);
    const windowEnd = new Date(twitterEventTime.getTime() + 6 * 3600000);

    const flows = await this.onchainFlows.aggregate([
      {
        $match: {
          asset,
          timestamp: { $gte: windowStart, $lte: windowEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalFlow: { $sum: '$amount' },
          avgTimestamp: { $avg: { $toLong: '$timestamp' } }
        }
      }
    ]).toArray();

    const flow = flows[0];
    const onchainFlow = flow?.totalFlow ?? 0;
    const onchainIntensity = Math.min(100, (onchainFlow / 1000000) * 10); // Normalize

    // Calculate time delta
    const avgFlowTime = flow?.avgTimestamp ? new Date(flow.avgTimestamp) : twitterEventTime;
    const timeDeltaHours = Math.abs(avgFlowTime.getTime() - twitterEventTime.getTime()) / 3600000;

    // Calculate correlation
    const { correlation, label } = correlateBotAndOnchain(
      bms,
      { intensity: onchainIntensity },
      timeDeltaHours
    );

    const report: ManipulationCorrelationReport = {
      asset,
      actorId,
      bms,
      onchainFlow,
      onchainIntensity: Math.round(onchainIntensity * 100) / 100,
      timeDeltaHours: Math.round(timeDeltaHours * 10) / 10,
      correlation: Math.round(correlation * 100) / 100,
      label,
      window: `T${timeDeltaHours > 0 ? '+' : ''}${timeDeltaHours.toFixed(1)}h`,
      timestamp: new Date().toISOString()
    };

    // Log
    await this.correlationLog.insertOne(report);

    return report;
  }

  /**
   * Get correlation history for an asset
   */
  async getHistory(asset: string, limit = 50): Promise<ManipulationCorrelationReport[]> {
    const docs = await this.correlationLog
      .find({ asset })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return docs as unknown as ManipulationCorrelationReport[];
  }
}
