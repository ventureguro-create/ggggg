/**
 * Profile Resolver
 * 
 * Auto-classifies accounts into scoring profiles based on followers.
 */

import type { ScoringProfile } from './connections-profiles.js';

// Thresholds (can be tuned via config later)
const RETAIL_MAX = 50_000;
const INFLUENCER_MAX = 500_000;

/**
 * Resolve scoring profile based on follower count
 */
export function resolveScoringProfile(followersNow: number): ScoringProfile {
  if (followersNow < RETAIL_MAX) return 'retail';
  if (followersNow < INFLUENCER_MAX) return 'influencer';
  return 'whale';
}

/**
 * Get profile thresholds for UI/explain
 */
export function getProfileThresholds(): {
  retail: { min: number; max: number };
  influencer: { min: number; max: number };
  whale: { min: number; max: number };
} {
  return {
    retail: { min: 0, max: RETAIL_MAX },
    influencer: { min: RETAIL_MAX, max: INFLUENCER_MAX },
    whale: { min: INFLUENCER_MAX, max: Infinity },
  };
}

/**
 * Check if two accounts are in the same profile
 */
export function isSameProfile(followersA: number, followersB: number): boolean {
  return resolveScoringProfile(followersA) === resolveScoringProfile(followersB);
}
