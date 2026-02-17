/**
 * BLOCK 28 - Strategy Simulation Service
 * 
 * Validates system by simulating following different actor types
 */

import type { Db, Collection, Document } from 'mongodb';
import { calculateStrategyMetrics, STRATEGIES, type StrategyConfig, type StrategyEvent, type StrategyMetrics } from '../formulas/strategy-simulation.js';

export interface StrategySimulationReport {
  strategy: string;
  description: string;
  window: string;
  metrics: StrategyMetrics;
  events: StrategyEvent[];
  updatedAt: string;
}

export class StrategySimulationService {
  private actorProfiles: Collection<Document>;
  private actorEvents: Collection<Document>;
  private priceHistory: Collection<Document>;
  private simulations: Collection<Document>;

  constructor(private db: Db) {
    this.actorProfiles = db.collection('actor_behavior_profiles');
    this.actorEvents = db.collection('actor_events');
    this.priceHistory = db.collection('price_history');
    this.simulations = db.collection('strategy_simulations');
  }

  /**
   * Run strategy simulation
   */
  async simulate(params: {
    strategyName: string;
    windowDays?: number;
    limit?: number;
  }): Promise<StrategySimulationReport> {
    const { strategyName, windowDays = 30, limit = 100 } = params;

    // Get strategy config
    const strategy = STRATEGIES.find(s => s.name === strategyName);
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }

    const since = new Date(Date.now() - windowDays * 86400000);

    // Get matching actors
    const actors = await this.getMatchingActors(strategy, limit);

    // Get events from matching actors
    const events: StrategyEvent[] = [];

    for (const actor of actors) {
      const actorEvents = await this.actorEvents
        .find({
          actorId: actor.actorId,
          timestamp: { $gte: since },
          asset: { $exists: true }
        })
        .limit(10)
        .toArray();

      for (const e of actorEvents) {
        const priceData = await this.getPriceData(e.asset, new Date(e.timestamp));
        if (priceData) {
          events.push({
            eventId: e._id.toString(),
            actorId: actor.actorId,
            asset: e.asset,
            timestamp: e.timestamp,
            priceAtMention: priceData.atMention,
            priceAfter1h: priceData.after1h,
            priceAfter4h: priceData.after4h,
            priceAfter24h: priceData.after24h,
            wasConfirmed: priceData.after24h > priceData.atMention
          });
        }
      }
    }

    // Calculate metrics
    const metrics = calculateStrategyMetrics(events);

    const report: StrategySimulationReport = {
      strategy: strategyName,
      description: strategy.description,
      window: `${windowDays}d`,
      metrics,
      events: events.slice(0, 50), // Limit stored events
      updatedAt: new Date().toISOString()
    };

    // Cache
    await this.simulations.updateOne(
      { strategy: strategyName },
      { $set: report },
      { upsert: true }
    );

    return report;
  }

  /**
   * Get cached simulation
   */
  async get(strategyName: string): Promise<StrategySimulationReport | null> {
    const doc = await this.simulations.findOne({ strategy: strategyName });
    return doc as unknown as StrategySimulationReport | null;
  }

  /**
   * Get all available strategies
   */
  getStrategies(): StrategyConfig[] {
    return STRATEGIES;
  }

  /**
   * Compare two strategies
   */
  async compare(strategyA: string, strategyB: string): Promise<{
    strategyA: StrategySimulationReport | null;
    strategyB: StrategySimulationReport | null;
    winner: string | null;
    comparison: {
      metric: string;
      strategyA: number;
      strategyB: number;
      better: string;
    }[];
  }> {
    const a = await this.get(strategyA);
    const b = await this.get(strategyB);

    if (!a || !b) {
      return { strategyA: a, strategyB: b, winner: null, comparison: [] };
    }

    const comparison = [
      {
        metric: 'Hit Rate',
        strategyA: a.metrics.hitRate,
        strategyB: b.metrics.hitRate,
        better: a.metrics.hitRate > b.metrics.hitRate ? strategyA : strategyB
      },
      {
        metric: 'Avg Follow Through',
        strategyA: a.metrics.avgFollowThrough,
        strategyB: b.metrics.avgFollowThrough,
        better: a.metrics.avgFollowThrough > b.metrics.avgFollowThrough ? strategyA : strategyB
      },
      {
        metric: 'Noise Ratio',
        strategyA: a.metrics.noiseRatio,
        strategyB: b.metrics.noiseRatio,
        better: a.metrics.noiseRatio < b.metrics.noiseRatio ? strategyA : strategyB
      }
    ];

    const aWins = comparison.filter(c => c.better === strategyA).length;
    const bWins = comparison.filter(c => c.better === strategyB).length;
    const winner = aWins > bWins ? strategyA : aWins < bWins ? strategyB : null;

    return { strategyA: a, strategyB: b, winner, comparison };
  }

  /**
   * Get actors matching strategy filters
   */
  private async getMatchingActors(strategy: StrategyConfig, limit: number): Promise<any[]> {
    const query: any = {};

    if (strategy.filters.profileTypes?.length) {
      query.profile = { $in: strategy.filters.profileTypes };
    }

    if (strategy.filters.minAuthenticity) {
      query.confidence = { $gte: strategy.filters.minAuthenticity / 100 };
    }

    return this.actorProfiles
      .find(query)
      .limit(limit)
      .toArray();
  }

  /**
   * Get price data for an asset at a given time
   */
  private async getPriceData(asset: string, timestamp: Date): Promise<{
    atMention: number;
    after1h: number;
    after4h: number;
    after24h: number;
  } | null> {
    const prices = await this.priceHistory
      .find({
        asset,
        timestamp: {
          $gte: new Date(timestamp.getTime() - 3600000),
          $lte: new Date(timestamp.getTime() + 25 * 3600000)
        }
      })
      .sort({ timestamp: 1 })
      .toArray();

    if (prices.length < 2) return null;

    const atMention = prices[0]?.price ?? 100;
    const after1h = prices.find((p: any) =>
      new Date(p.timestamp).getTime() >= timestamp.getTime() + 3600000
    )?.price ?? atMention;
    const after4h = prices.find((p: any) =>
      new Date(p.timestamp).getTime() >= timestamp.getTime() + 4 * 3600000
    )?.price ?? atMention;
    const after24h = prices.find((p: any) =>
      new Date(p.timestamp).getTime() >= timestamp.getTime() + 24 * 3600000
    )?.price ?? atMention;

    return { atMention, after1h, after4h, after24h };
  }
}
