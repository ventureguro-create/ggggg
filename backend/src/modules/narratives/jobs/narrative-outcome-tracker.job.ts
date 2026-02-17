/**
 * Narrative Outcome Tracking Job
 * Автоматическое отслеживание outcomes (1h/4h/24h)
 */

import { Db } from 'mongodb';
import { NarrativeOutcome } from '../models/narrative.types.js';

const HORIZONS = ['1h', '4h', '24h'] as const;
type Horizon = typeof HORIZONS[number];

const HORIZON_MS: Record<Horizon, number> = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// Thresholds for outcome classification
const TP_THRESHOLD = 0.03; // 3% move in direction
const FP_THRESHOLD = -0.02; // -2% move against
const WEAK_THRESHOLD = 0.01; // 1% - weak move

export interface NarrativeEvent {
  _id: any;
  narrativeKey: string;
  symbol: string;
  eventAt: Date;
  nms: number;
  socialWeight: number;
  direction: 'UP' | 'DOWN';
  priceAtEvent: number;
  processed: Record<Horizon, boolean>;
}

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: Date;
}

export class NarrativeOutcomeTrackerJob {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private db: Db) {}

  /**
   * Start the outcome tracking job
   */
  start(intervalMs = 5 * 60 * 1000): void {
    if (this.isRunning) {
      console.log('[OutcomeTracker] Already running');
      return;
    }

    console.log('[OutcomeTracker] Starting job...');
    this.isRunning = true;

    // Run immediately
    this.runCycle();

    // Then run on interval
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
    console.log('[OutcomeTracker] Stopped');
  }

  /**
   * Run a single cycle
   */
  async runCycle(): Promise<void> {
    console.log('[OutcomeTracker] Running cycle...');

    try {
      // Process each horizon
      for (const horizon of HORIZONS) {
        await this.processHorizon(horizon);
      }

      // Clean up old events
      await this.cleanupOldEvents();

      console.log('[OutcomeTracker] Cycle complete');
    } catch (err) {
      console.error('[OutcomeTracker] Cycle error:', err);
    }
  }

  /**
   * Process events for a specific horizon
   */
  private async processHorizon(horizon: Horizon): Promise<void> {
    const horizonMs = HORIZON_MS[horizon];
    const cutoffTime = new Date(Date.now() - horizonMs);

    // Find events that need processing for this horizon
    const events = await this.db.collection<NarrativeEvent>('narrative_events')
      .find({
        eventAt: { $lte: cutoffTime },
        [`processed.${horizon}`]: { $ne: true },
      })
      .limit(50)
      .toArray();

    if (events.length === 0) return;

    console.log(`[OutcomeTracker] Processing ${events.length} events for ${horizon}`);

    for (const event of events) {
      try {
        await this.processEvent(event, horizon);
      } catch (err) {
        console.error(`[OutcomeTracker] Error processing event ${event._id}:`, err);
      }
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: NarrativeEvent, horizon: Horizon): Promise<void> {
    // Get current price
    const currentPrice = await this.getCurrentPrice(event.symbol);
    if (!currentPrice) {
      console.warn(`[OutcomeTracker] No price for ${event.symbol}`);
      return;
    }

    // Calculate return
    const retPct = (currentPrice.price - event.priceAtEvent) / event.priceAtEvent;

    // Determine outcome
    const realized = retPct > WEAK_THRESHOLD ? 'UP' : retPct < -WEAK_THRESHOLD ? 'DOWN' : 'FLAT';
    const directionCorrect = (event.direction === 'UP' && retPct > 0) || 
                             (event.direction === 'DOWN' && retPct < 0);

    let label: NarrativeOutcome['label'];
    if (directionCorrect && Math.abs(retPct) >= TP_THRESHOLD) {
      label = 'TP';
    } else if (!directionCorrect && Math.abs(retPct) >= Math.abs(FP_THRESHOLD)) {
      label = 'FP';
    } else if (Math.abs(retPct) < WEAK_THRESHOLD) {
      label = 'NOISE';
    } else {
      label = 'WEAK';
    }

    // Record outcome
    const outcome: Omit<NarrativeOutcome, '_id' | 'createdAt'> = {
      narrativeKey: event.narrativeKey,
      symbol: event.symbol,
      eventAt: event.eventAt,
      window: horizon,
      nms: event.nms,
      socialWeight: event.socialWeight,
      retPct,
      realized,
      label,
    };

    await this.db.collection('narrative_outcomes').insertOne({
      ...outcome,
      createdAt: new Date(),
    });

    // Mark event as processed for this horizon
    await this.db.collection('narrative_events').updateOne(
      { _id: event._id },
      { $set: { [`processed.${horizon}`]: true } }
    );

    // Update narrative stats
    await this.updateNarrativeStats(event.narrativeKey, label, retPct);

    console.log(`[OutcomeTracker] ${event.symbol}@${horizon}: ${label} (${(retPct * 100).toFixed(2)}%)`);
  }

  /**
   * Get current price for symbol
   */
  private async getCurrentPrice(symbol: string): Promise<PriceData | null> {
    // Try exchange_observations first
    const observation = await this.db.collection('exchange_observations')
      .findOne(
        { symbol },
        { sort: { ts: -1 } }
      );

    if (observation && observation.price) {
      return {
        symbol,
        price: observation.price,
        timestamp: observation.ts,
      };
    }

    // Fallback: check price_snapshots
    const snapshot = await this.db.collection('price_snapshots')
      .findOne(
        { symbol },
        { sort: { timestamp: -1 } }
      );

    if (snapshot && snapshot.price) {
      return {
        symbol,
        price: snapshot.price,
        timestamp: snapshot.timestamp,
      };
    }

    return null;
  }

  /**
   * Update narrative predictiveness stats
   */
  private async updateNarrativeStats(
    narrativeKey: string,
    label: NarrativeOutcome['label'],
    retPct: number
  ): Promise<void> {
    const update: any = {
      $inc: { totalOutcomes: 1 },
      $set: { lastOutcomeAt: new Date() },
    };

    if (label === 'TP') {
      update.$inc.tpCount = 1;
      update.$inc.totalReturn = retPct;
    } else if (label === 'FP') {
      update.$inc.fpCount = 1;
    }

    await this.db.collection('narrative_stats').updateOne(
      { narrativeKey },
      update,
      { upsert: true }
    );
  }

  /**
   * Clean up old events (fully processed)
   */
  private async cleanupOldEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.db.collection('narrative_events').deleteMany({
      eventAt: { $lt: cutoff },
      'processed.1h': true,
      'processed.4h': true,
      'processed.24h': true,
    });
  }

  /**
   * Create a narrative event (called when narrative crosses NMS threshold)
   */
  async createEvent(
    narrativeKey: string,
    symbol: string,
    nms: number,
    socialWeight: number,
    direction: 'UP' | 'DOWN',
    priceAtEvent: number
  ): Promise<void> {
    const event: Omit<NarrativeEvent, '_id'> = {
      narrativeKey,
      symbol,
      eventAt: new Date(),
      nms,
      socialWeight,
      direction,
      priceAtEvent,
      processed: { '1h': false, '4h': false, '24h': false },
    };

    await this.db.collection('narrative_events').insertOne(event);
    console.log(`[OutcomeTracker] Created event: ${narrativeKey}/${symbol} @ $${priceAtEvent}`);
  }

  /**
   * Get pending events count
   */
  async getPendingCount(): Promise<Record<Horizon, number>> {
    const result: Record<Horizon, number> = { '1h': 0, '4h': 0, '24h': 0 };

    for (const horizon of HORIZONS) {
      result[horizon] = await this.db.collection('narrative_events')
        .countDocuments({ [`processed.${horizon}`]: { $ne: true } });
    }

    return result;
  }
}
