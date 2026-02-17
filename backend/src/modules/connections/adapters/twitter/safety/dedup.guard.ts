/**
 * Deduplication Guard
 * 
 * Prevents duplicate data from being processed.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter Safety
 */

import crypto from 'crypto';

/**
 * In-memory dedup cache (TTL-based)
 */
class DedupCache {
  private cache = new Map<string, number>(); // hash -> timestamp
  private ttlMs: number;
  private maxSize: number;
  
  constructor(ttlHours = 24, maxSize = 10000) {
    this.ttlMs = ttlHours * 60 * 60 * 1000;
    this.maxSize = maxSize;
  }
  
  /**
   * Check if hash exists and is not expired
   */
  has(hash: string): boolean {
    const timestamp = this.cache.get(hash);
    if (!timestamp) return false;
    
    if (Date.now() - timestamp > this.ttlMs) {
      this.cache.delete(hash);
      return false;
    }
    
    return true;
  }
  
  /**
   * Add hash to cache
   */
  add(hash: string): void {
    // Evict old entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    this.cache.set(hash, Date.now());
  }
  
  /**
   * Remove oldest entries
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1] - b[1]);
    
    // Remove oldest 10%
    const toRemove = Math.ceil(this.maxSize * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache stats
   */
  stats(): { size: number; maxSize: number; ttlHours: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlHours: this.ttlMs / (60 * 60 * 1000),
    };
  }
}

// Singleton cache instance
const dedupCache = new DedupCache();

/**
 * Generate hash for deduplication
 */
export function generateDedupHash(
  type: 'author' | 'engagement' | 'follow',
  ...parts: (string | number | undefined)[]
): string {
  const data = [type, ...parts.filter(p => p !== undefined)].join(':');
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Check if item is duplicate
 */
export function isDuplicate(hash: string): boolean {
  return dedupCache.has(hash);
}

/**
 * Mark item as processed
 */
export function markProcessed(hash: string): void {
  dedupCache.add(hash);
}

/**
 * Process items with deduplication
 * Returns only non-duplicate items
 */
export function filterDuplicates<T>(
  items: T[],
  hashFn: (item: T) => string
): { unique: T[]; duplicates: number } {
  const unique: T[] = [];
  let duplicates = 0;
  
  for (const item of items) {
    const hash = hashFn(item);
    if (!isDuplicate(hash)) {
      unique.push(item);
      markProcessed(hash);
    } else {
      duplicates++;
    }
  }
  
  return { unique, duplicates };
}

/**
 * Clear dedup cache (for testing)
 */
export function clearDedupCache(): void {
  dedupCache.clear();
}

/**
 * Get dedup stats
 */
export function getDedupStats() {
  return dedupCache.stats();
}
