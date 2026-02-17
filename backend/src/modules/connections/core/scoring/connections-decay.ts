/**
 * Time Decay Functions
 * 
 * Exponential decay: recent posts matter more.
 * 
 * weight(t) = exp(-λ * age_days)
 * λ = ln(2) / half_life
 */

/**
 * Get half-life in days based on window size
 */
export function getHalfLife(windowDays: number): number {
  if (windowDays <= 7) return 2;    // 7d window: half-life 2 days
  if (windowDays <= 14) return 4;   // 14d window: half-life 4 days
  if (windowDays <= 30) return 7;   // 30d window: half-life 7 days
  return 21;                         // 90d window: half-life 21 days
}

/**
 * Calculate decay weight for a post
 * 
 * @param createdAt - Post creation timestamp
 * @param now - Current timestamp (ms)
 * @param windowDays - Window size for half-life lookup
 * @returns Weight between 0 and 1
 */
export function decayWeight(
  createdAt: string | number | Date,
  now: number,
  windowDays: number
): number {
  const postTime = new Date(createdAt).getTime();
  const ageDays = (now - postTime) / (24 * 60 * 60 * 1000); // ms to days
  
  // Future posts get full weight
  if (ageDays < 0) return 1;
  
  const halfLife = getHalfLife(windowDays);
  const lambda = Math.LN2 / halfLife; // ln(2) / half_life
  
  return Math.exp(-lambda * ageDays);
}

/**
 * Calculate decay weights for multiple posts
 */
export function calculateDecayWeights(
  posts: Array<{ created_at: string }>,
  windowDays: number
): number[] {
  const now = Date.now();
  return posts.map(p => decayWeight(p.created_at, now, windowDays));
}

/**
 * Get decay info for explain layer
 */
export function getDecayInfo(windowDays: number): {
  half_life_days: number;
  description: string;
} {
  const halfLife = getHalfLife(windowDays);
  return {
    half_life_days: halfLife,
    description: `Posts lose 50% weight every ${halfLife} days. Recent activity matters more.`,
  };
}
