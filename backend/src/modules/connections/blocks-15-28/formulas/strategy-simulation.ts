/**
 * BLOCK 28 - Strategy Simulation Engine
 * 
 * Validates the system by simulating following different actor types
 */

export interface StrategyConfig {
  name: string;
  description: string;
  filters: {
    profileTypes?: string[];
    minRealityScore?: number;
    minAuthority?: number;
    minAuthenticity?: number;
  };
}

export interface StrategyEvent {
  eventId: string;
  actorId: string;
  asset: string;
  timestamp: string;
  priceAtMention: number;
  priceAfter1h: number;
  priceAfter4h: number;
  priceAfter24h: number;
  wasConfirmed: boolean;
}

export interface StrategyMetrics {
  hitRate: number;           // % events with confirmation
  avgFollowThrough: number;  // avg price move %
  noiseRatio: number;        // % false positives
  confirmationLag: number;   // avg hours to confirmation
  sampleSize: number;
}

/**
 * Calculate strategy metrics from events
 */
export function calculateStrategyMetrics(events: StrategyEvent[]): StrategyMetrics {
  if (!events.length) {
    return {
      hitRate: 0,
      avgFollowThrough: 0,
      noiseRatio: 1,
      confirmationLag: 0,
      sampleSize: 0
    };
  }

  const confirmed = events.filter(e => e.wasConfirmed);
  const hitRate = confirmed.length / events.length;

  // Calculate avg follow through (price move %)
  const moves = events.map(e => {
    const move24h = ((e.priceAfter24h - e.priceAtMention) / e.priceAtMention) * 100;
    return move24h;
  });
  const avgFollowThrough = moves.reduce((s, m) => s + m, 0) / moves.length;

  // Noise = false positives
  const noiseRatio = 1 - hitRate;

  // Confirmation lag (simplified: assume 4h if confirmed)
  const confirmationLag = confirmed.length > 0 ? 4 : 0;

  return {
    hitRate,
    avgFollowThrough,
    noiseRatio,
    confirmationLag,
    sampleSize: events.length
  };
}

/**
 * Predefined strategies
 */
export const STRATEGIES: StrategyConfig[] = [
  {
    name: 'EARLY_CONVICTION_ONLY',
    description: 'Follow only Early Conviction actors',
    filters: {
      profileTypes: ['EARLY_CONVICTION'],
      minRealityScore: 70,
      minAuthority: 60
    }
  },
  {
    name: 'LONG_TERM_ACCUMULATORS',
    description: 'Follow only Long-Term Accumulators',
    filters: {
      profileTypes: ['LONG_TERM_ACCUMULATOR'],
      minRealityScore: 60
    }
  },
  {
    name: 'HIGH_AUTHENTICITY',
    description: 'Follow any actor with high authenticity',
    filters: {
      minAuthenticity: 75
    }
  },
  {
    name: 'AVOID_PUMP_EXIT',
    description: 'Follow anyone except Pump & Exit actors',
    filters: {
      profileTypes: ['LONG_TERM_ACCUMULATOR', 'EARLY_CONVICTION', 'LIQUIDITY_PROVIDER']
    }
  }
];
