/**
 * Scroll Policies - реальные цифры без магии
 * 
 * SAFE: ≈150-220 posts/hour
 * NORMAL: ≈220-320 posts/hour  
 * AGGRESSIVE: ≈320-450 posts/hour
 */

import { ScrollProfile, ScrollPolicy } from './scroll.types.js';

export const SCROLL_POLICIES: Record<ScrollProfile, ScrollPolicy> = {
  [ScrollProfile.SAFE]: {
    minDelayMs: 2200,
    maxDelayMs: 4200,
    scrollPxMin: 650,
    scrollPxMax: 1050,
    microJitterMax: 900,
    batchSizeMin: 3,
    batchSizeMax: 6,
    expectedPostsPerHour: 180,
  },
  
  [ScrollProfile.NORMAL]: {
    minDelayMs: 1500,
    maxDelayMs: 2800,
    scrollPxMin: 800,
    scrollPxMax: 1400,
    microJitterMax: 600,
    batchSizeMin: 5,
    batchSizeMax: 9,
    expectedPostsPerHour: 270,
  },
  
  [ScrollProfile.AGGRESSIVE]: {
    minDelayMs: 900,
    maxDelayMs: 1800,
    scrollPxMin: 1000,
    scrollPxMax: 1800,
    microJitterMax: 400,
    batchSizeMin: 7,
    batchSizeMax: 12,
    expectedPostsPerHour: 380,
  },
};

/**
 * Random value in range
 */
export function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get next profile in downgrade chain
 */
export function downgradeProfile(current: ScrollProfile): ScrollProfile | null {
  switch (current) {
    case ScrollProfile.AGGRESSIVE:
      return ScrollProfile.NORMAL;
    case ScrollProfile.NORMAL:
      return ScrollProfile.SAFE;
    case ScrollProfile.SAFE:
      return null;
  }
}

/**
 * Get cooldown pause after HIGH risk (ms)
 */
export function getCooldownPause(): number {
  return randomInRange(10000, 25000);
}
