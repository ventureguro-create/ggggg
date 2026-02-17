/**
 * Alpha Outcome Tracking Job
 * Автоматическое отслеживание alpha outcomes (БЛОК 21)
 */

import { Db, ObjectId } from 'mongodb';
import { AlphaCandidate, AlphaOutcome } from '../alpha.types.js';

const HORIZONS = ['1h', '4h', '24h'] as const;
type Horizon = typeof HORIZONS[number];

const HORIZON_MS: Record<Horizon, number> = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// Classification thresholds
const TP_THRESHOLD = 0.025; // 2.5% move in direction
const WEAK_THRESHOLD = 0.01; // 1%

interface TrackedAlpha extends AlphaCandidate {
  priceAtCreation: number;
  trackedHorizons: Record<Horizon, boolean>;
}

export class AlphaOutcomeTrackerJob {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private db: Db) {}

  /**
   * Start the tracking job
   */
  start(intervalMs = 5 * 60 * 1000): void {
    if (this.isRunning) {
      console.log('[AlphaTracker] Already running');
      return;
    }

    console.log('[AlphaTracker] Starting job...');
    this.isRunning = true;

    // Run immediately then on interval
    this.runCycle();
    this.intervalId = setInterval(() => this.runCycle(), intervalMs);
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[AlphaTracker] Stopped');
  }

  /**
   * Run tracking cycle
   */
  async runCycle(): Promise<void> {
    console.log('[AlphaTracker] Running cycle...');

    try {
      for (const horizon of HORIZONS) {
        await this.processHorizon(horizon);
      }

      // Update system stats
      await this.updateSystemStats();

      console.log('[AlphaTracker] Cycle complete');
    } catch (err) {
      console.error('[AlphaTracker] Cycle error:', err);
    }
  }

  /**
   * Process alphas for a horizon
   */
  private async processHorizon(horizon: Horizon): Promise<void> {
    const horizonMs = HORIZON_MS[horizon];
    const cutoffTime = new Date(Date.now() - horizonMs);

    // Find alphas created before cutoff that haven't been processed for this horizon
    const alphas = await this.db.collection<TrackedAlpha>('alpha_candidates')
      .find({
        timestamp: { $lte: cutoffTime },
        [`trackedHorizons.${horizon}`]: { $ne: true },
      })
      .limit(50)
      .toArray();

    if (alphas.length === 0) return;

    console.log(`[AlphaTracker] Processing ${alphas.length} alphas for ${horizon}`);

    for (const alpha of alphas) {
      await this.processAlpha(alpha, horizon);
    }
  }

  /**
   * Process single alpha
   */
  private async processAlpha(alpha: TrackedAlpha, horizon: Horizon): Promise<void> {
    // Get current price
    const currentPrice = await this.getCurrentPrice(alpha.asset);
    if (!currentPrice || !alpha.priceAtCreation) {
      // Mark as processed with NO_MOVE if no price data
      await this.markProcessed(alpha._id, horizon);
      return;
    }

    const returnPct = (currentPrice - alpha.priceAtCreation) / alpha.priceAtCreation;

    // Determine if direction was correct
    const directionCorrect = 
      (alpha.direction === 'BUY' && returnPct > 0) ||
      (alpha.direction === 'SELL' && returnPct < 0);

    // Get max favorable/adverse (simplified - would need candle data for real implementation)
    const maxFavorable = Math.max(0, returnPct);
    const maxAdverse = Math.min(0, returnPct);

    // Classify result
    let result: AlphaOutcome['result'];
    if (Math.abs(returnPct) < WEAK_THRESHOLD) {
      result = 'NO_MOVE';
    } else if (directionCorrect && Math.abs(returnPct) >= TP_THRESHOLD) {
      result = 'TP';
    } else if (!directionCorrect && Math.abs(returnPct) >= TP_THRESHOLD) {
      result = 'FP';
    } else {
      result = 'WEAK';
    }

    // Record outcome
    const outcome: Omit<AlphaOutcome, '_id' | 'createdAt'> = {
      alphaId: alpha._id.toString(),
      asset: alpha.asset,
      horizon,
      result,
      returnPct,
      maxFavorableMove: maxFavorable,
      maxAdverseMove: Math.abs(maxAdverse),
    };

    await this.db.collection('alpha_outcomes').insertOne({
      ...outcome,
      createdAt: new Date(),
    });

    await this.markProcessed(alpha._id, horizon);

    console.log(`[AlphaTracker] ${alpha.asset}@${horizon}: ${result} (${(returnPct * 100).toFixed(2)}%)`);

    // Feedback to narrative/influencer layers
    await this.provideFeedback(alpha, result, returnPct);
  }

  /**
   * Get current price for asset
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    const observation = await this.db.collection('exchange_observations')
      .findOne({ symbol }, { sort: { ts: -1 } });

    return observation?.price || null;
  }

  /**
   * Mark alpha as processed for horizon
   */
  private async markProcessed(alphaId: ObjectId, horizon: Horizon): Promise<void> {
    await this.db.collection('alpha_candidates').updateOne(
      { _id: alphaId },
      { $set: { [`trackedHorizons.${horizon}`]: true } }
    );
  }

  /**
   * Provide feedback to narrative and influencer layers
   */
  private async provideFeedback(
    alpha: TrackedAlpha,
    result: AlphaOutcome['result'],
    returnPct: number
  ): Promise<void> {
    // Update narrative stats
    if (alpha.narrative) {
      const isTP = result === 'TP';
      const update: any = {
        $inc: { feedbackCount: 1 },
        $set: { lastFeedbackAt: new Date() },
      };

      if (isTP) {
        update.$inc.successCount = 1;
        update.$inc.totalReturn = returnPct;
      }

      await this.db.collection('narratives').updateOne(
        { key: alpha.narrative },
        update
      );
    }
  }

  /**
   * Update overall system stats
   */
  private async updateSystemStats(): Promise<void> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const outcomes = await this.db.collection<AlphaOutcome>('alpha_outcomes')
      .find({ createdAt: { $gte: weekAgo } })
      .toArray();

    if (outcomes.length === 0) return;

    const tp = outcomes.filter(o => o.result === 'TP');
    const fp = outcomes.filter(o => o.result === 'FP');

    const stats = {
      hitRate: tp.length / outcomes.length,
      avgReturn: tp.length > 0 
        ? tp.reduce((sum, o) => sum + o.returnPct, 0) / tp.length 
        : 0,
      falseAlphaRate: fp.length / outcomes.length,
      totalOutcomes: outcomes.length,
      updatedAt: new Date(),
    };

    await this.db.collection('alpha_system_stats').updateOne(
      { type: 'weekly' },
      { $set: stats },
      { upsert: true }
    );
  }

  /**
   * Get tracker status
   */
  async getStatus(): Promise<{ running: boolean; pending: Record<Horizon, number> }> {
    const pending: Record<Horizon, number> = { '1h': 0, '4h': 0, '24h': 0 };

    for (const horizon of HORIZONS) {
      pending[horizon] = await this.db.collection('alpha_candidates')
        .countDocuments({ [`trackedHorizons.${horizon}`]: { $ne: true } });
    }

    return { running: this.isRunning, pending };
  }
}
