/**
 * Neutral Event Builder
 * 
 * Converts Twitter events to neutral format.
 */

import { NeutralEvent } from '../contracts/neutral-event.types.js';

export function buildNeutralEventFromTwitter(input: {
  tweetId: string;
  actorId: string;
  asset: string;
  occurredAt: string;
  twitterScore?: number;
  engagementSpike?: number;
  networkSupport?: number;
  authority?: number;
  intentType?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'NARRATIVE';
}): NeutralEvent {
  return {
    eventId: `tw_${input.tweetId}`,
    source: 'TWITTER',
    asset: input.asset,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    signals: {
      twitter_score_0_1000: input.twitterScore,
      engagement_spike_0_1: input.engagementSpike,
      network_support_0_1: input.networkSupport,
      authority_0_1: input.authority,
    },
    meta: {
      tweetId: input.tweetId,
      intentType: input.intentType,
    },
  };
}

export function buildNeutralEventManual(input: {
  eventId: string;
  asset: string;
  actorId?: string;
  occurredAt?: string;
}): NeutralEvent {
  return {
    eventId: input.eventId,
    source: 'MANUAL',
    asset: input.asset,
    actorId: input.actorId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}
