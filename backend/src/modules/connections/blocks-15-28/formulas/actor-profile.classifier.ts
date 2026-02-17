/**
 * BLOCK 27 - Actor Behavior Profiles
 * 
 * Classifies actors by their historical behavior patterns
 */

export type ActorProfileType = 
  | 'LONG_TERM_ACCUMULATOR'
  | 'PUMP_AND_EXIT'
  | 'EARLY_CONVICTION'
  | 'LIQUIDITY_PROVIDER'
  | 'NOISE_ACTOR';

export interface BehaviorVector {
  accumulationBias: number;          // 0-1: how much they accumulate vs distribute
  tweetLeadLag: number;              // hours: negative = tweets before action
  distributionAfterMentions: number; // 0-1: how often they sell after tweeting
  holdingDuration: number;           // days: avg hold time
  confirmationRatio: number;         // 0-1: % of times their signal was right
  directionalVariance: number;       // 0-1: how consistent their direction is
}

/**
 * Classify actor based on behavior vector
 */
export function classifyActor(profile: BehaviorVector): ActorProfileType {
  // Long-term accumulator: accumulates, rarely wrong
  if (profile.accumulationBias > 0.7 && profile.confirmationRatio > 0.8) {
    return 'LONG_TERM_ACCUMULATOR';
  }

  // Pump & Exit: sells after mentions
  if (profile.distributionAfterMentions > 0.6) {
    return 'PUMP_AND_EXIT';
  }

  // Early Conviction: tweets before accumulation
  if (profile.tweetLeadLag < -2 && profile.accumulationBias > 0.5) {
    return 'EARLY_CONVICTION';
  }

  // Liquidity Provider: no directional bias
  if (profile.directionalVariance < 0.2) {
    return 'LIQUIDITY_PROVIDER';
  }

  return 'NOISE_ACTOR';
}

export function getProfileDescription(profile: ActorProfileType): string {
  switch (profile) {
    case 'LONG_TERM_ACCUMULATOR':
      return 'Quietly buys, rarely speaks, often right';
    case 'PUMP_AND_EXIT':
      return 'Speaks when already selling';
    case 'EARLY_CONVICTION':
      return 'Knows before the market';
    case 'LIQUIDITY_PROVIDER':
      return 'Not about signals, about market';
    case 'NOISE_ACTOR':
      return 'Generates noise';
  }
}
