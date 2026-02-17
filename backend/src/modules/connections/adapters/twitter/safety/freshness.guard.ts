/**
 * Freshness Guard
 * 
 * Ensures data is recent enough to be useful.
 * Stale data can lead to incorrect scores.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter Safety
 */

import type { TwitterAdapterConfig } from '../adapter/twitter-adapter.config.js';

/**
 * Freshness check result
 */
export interface FreshnessResult {
  is_fresh: boolean;
  age_hours: number;
  max_age_hours: number;
  warning?: string;
}

/**
 * Check if timestamp is fresh enough
 */
export function checkFreshness(
  timestamp: Date | string | number,
  config: TwitterAdapterConfig,
  dataType: 'author' | 'engagement' | 'follow' = 'author'
): FreshnessResult {
  const date = new Date(timestamp);
  const now = new Date();
  const ageMs = now.getTime() - date.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  
  // Get max age based on data type
  const maxAgeConfig = config.safety.max_data_age_hours || {
    author: 24,
    engagement: 6,
    follow: 48,
  };
  
  const maxAgeHours = typeof maxAgeConfig === 'number' 
    ? maxAgeConfig 
    : (maxAgeConfig[dataType] || 24);
  
  const isFresh = ageHours <= maxAgeHours;
  
  return {
    is_fresh: isFresh,
    age_hours: Math.round(ageHours * 10) / 10,
    max_age_hours: maxAgeHours,
    warning: !isFresh 
      ? `Data is ${ageHours.toFixed(1)}h old (max ${maxAgeHours}h)` 
      : undefined,
  };
}

/**
 * Filter items by freshness
 */
export function filterByFreshness<T>(
  items: T[],
  getTimestamp: (item: T) => Date | string | number,
  config: TwitterAdapterConfig,
  dataType: 'author' | 'engagement' | 'follow' = 'author'
): { fresh: T[]; stale: T[]; staleCount: number } {
  const fresh: T[] = [];
  const stale: T[] = [];
  
  for (const item of items) {
    const ts = getTimestamp(item);
    const result = checkFreshness(ts, config, dataType);
    
    if (result.is_fresh) {
      fresh.push(item);
    } else {
      stale.push(item);
    }
  }
  
  return { fresh, stale, staleCount: stale.length };
}

/**
 * Check if we have recent data for an author
 */
export function hasRecentData(
  lastUpdate: Date | string | number | null | undefined,
  config: TwitterAdapterConfig,
  dataType: 'author' | 'engagement' | 'follow' = 'author'
): boolean {
  if (!lastUpdate) return false;
  return checkFreshness(lastUpdate, config, dataType).is_fresh;
}

/**
 * Get freshness summary for multiple items
 */
export function getFreshnessSummary<T>(
  items: T[],
  getTimestamp: (item: T) => Date | string | number,
  config: TwitterAdapterConfig,
  dataType: 'author' | 'engagement' | 'follow' = 'author'
): {
  total: number;
  fresh: number;
  stale: number;
  freshPct: number;
  avgAgeHours: number;
} {
  if (items.length === 0) {
    return { total: 0, fresh: 0, stale: 0, freshPct: 100, avgAgeHours: 0 };
  }
  
  let freshCount = 0;
  let totalAgeHours = 0;
  
  for (const item of items) {
    const result = checkFreshness(getTimestamp(item), config, dataType);
    if (result.is_fresh) freshCount++;
    totalAgeHours += result.age_hours;
  }
  
  return {
    total: items.length,
    fresh: freshCount,
    stale: items.length - freshCount,
    freshPct: Math.round((freshCount / items.length) * 100),
    avgAgeHours: Math.round((totalAgeHours / items.length) * 10) / 10,
  };
}
