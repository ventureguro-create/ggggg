/**
 * NMS Threshold Detector Job
 * Детектирует когда нарратив пересекает порог и создаёт события
 */

import { Db } from 'mongodb';
import { Narrative } from '../models/narrative.types.js';
import { NarrativeOutcomeTrackerJob } from './narrative-outcome-tracker.job.js';

const NMS_THRESHOLD = 0.65; // Narrative is "activated" when NMS >= 0.65
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours between events for same narrative/symbol

export class NMSThresholdDetectorJob {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private outcomeTracker: NarrativeOutcomeTrackerJob;
  private lastEventTimes: Map<string, number> = new Map();

  constructor(private db: Db) {
    this.outcomeTracker = new NarrativeOutcomeTrackerJob(db);
  }

  /**
   * Start the detector
   */
  start(intervalMs = 60 * 1000): void {
    if (this.isRunning) return;

    console.log('[NMSDetector] Starting...');
    this.isRunning = true;

    // Also start outcome tracker
    this.outcomeTracker.start();

    // Run detection loop
    this.runCycle();
    this.intervalId = setInterval(() => this.runCycle(), intervalMs);
  }

  /**
   * Stop the detector
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.outcomeTracker.stop();
    console.log('[NMSDetector] Stopped');
  }

  /**
   * Run detection cycle
   */
  private async runCycle(): Promise<void> {
    try {
      // Get narratives above threshold
      const activeNarratives = await this.db.collection<Narrative>('narratives')
        .find({ nms: { $gte: NMS_THRESHOLD } })
        .toArray();

      for (const narrative of activeNarratives) {
        await this.checkNarrative(narrative);
      }
    } catch (err) {
      console.error('[NMSDetector] Cycle error:', err);
    }
  }

  /**
   * Check narrative and create events for linked tokens
   */
  private async checkNarrative(narrative: Narrative): Promise<void> {
    // Get bindings for this narrative
    const bindings = await this.db.collection('narrative_bindings')
      .find({ narrativeKey: narrative.key })
      .toArray();

    for (const binding of bindings) {
      const symbol = binding.symbol as string;
      const eventKey = `${narrative.key}:${symbol}`;

      // Check cooldown
      const lastTime = this.lastEventTimes.get(eventKey) || 0;
      if (Date.now() - lastTime < COOLDOWN_MS) continue;

      // Get current price
      const price = await this.getCurrentPrice(symbol);
      if (!price) continue;

      // Calculate social weight
      const socialWeight = (narrative.nms || 0) * (binding.weight as number || 1);

      // Create event
      await this.outcomeTracker.createEvent(
        narrative.key,
        symbol,
        narrative.nms,
        socialWeight,
        'UP', // Default to UP for narrative signals
        price
      );

      this.lastEventTimes.set(eventKey, Date.now());
      console.log(`[NMSDetector] Event created: ${eventKey} @ $${price}`);
    }
  }

  /**
   * Get current price
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    const obs = await this.db.collection('exchange_observations')
      .findOne({ symbol }, { sort: { ts: -1 } });
    return obs?.price || null;
  }

  /**
   * Get detector status
   */
  getStatus(): { running: boolean; threshold: number; cooldownMs: number } {
    return {
      running: this.isRunning,
      threshold: NMS_THRESHOLD,
      cooldownMs: COOLDOWN_MS,
    };
  }
}
