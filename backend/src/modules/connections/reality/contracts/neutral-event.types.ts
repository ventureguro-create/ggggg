/**
 * Neutral Event Types
 * 
 * PHASE B: Unified event format that bridges Twitter → On-chain evaluation.
 * Connections Core creates these, not knowing the source details.
 */

export type NeutralEventSource = 'TWITTER' | 'SYSTEM' | 'MANUAL';

export type NeutralEvent = {
  eventId: string;
  source: NeutralEventSource;

  // what happened
  asset?: string;                 // "SOL", "ETH" (if applicable)
  actorId?: string;               // twitter account id / internal id
  occurredAt: string;             // ISO

  // context signals (without interpretations)
  signals?: {
    twitter_score_0_1000?: number;
    engagement_spike_0_1?: number;
    network_support_0_1?: number;
    authority_0_1?: number;
  };

  meta?: {
    tweetId?: string;
    textHash?: string;
    intentType?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'NARRATIVE';
  };
};
