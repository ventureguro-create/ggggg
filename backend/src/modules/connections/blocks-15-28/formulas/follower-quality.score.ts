/**
 * BLOCK 20 - Real Top Followers Scoring
 * 
 * Quality scoring for real followers (not bots/farms)
 */

export interface FollowerFeatures {
  followers: number;
  following: number;
  accountAgeDays: number;
  tweets30d: number;
  likes30d: number;
  retweets30d: number;
  followsPerDay: number;
  isVerified: boolean;
}

/**
 * Calculate quality score for a follower (0-100)
 */
export function followerQualityScore(f: FollowerFeatures): number {
  let score = 0;

  // Size with logarithm
  score += Math.min(25, Math.log10(f.followers + 1) * 10);

  // Activity
  score += Math.min(20, f.tweets30d * 0.6);
  score += Math.min(15, f.likes30d * 0.1);

  // Account maturity
  if (f.accountAgeDays > 365) score += 10;
  if (f.accountAgeDays > 730) score += 5;

  // Follow behavior (anti-farm)
  if (f.followsPerDay < 3) score += 10;
  else if (f.followsPerDay > 10) score -= 15;

  // Verified bonus
  if (f.isVerified) score += 10;

  return Math.max(0, Math.min(100, score));
}

export type FarmLevel = 'FARM' | 'PARTIAL' | 'CLEAN';

/**
 * Calculate farm penalty multiplier
 */
export function farmPenalty(args: {
  farmLevel: FarmLevel;
  sharedFarmEdges: number;
}): number {
  let p = 1.0;

  if (args.farmLevel === 'FARM') p *= 0.1;
  if (args.farmLevel === 'PARTIAL') p *= 0.6;

  if (args.sharedFarmEdges >= 3) p *= 0.5;
  if (args.sharedFarmEdges >= 6) p *= 0.3;

  return p;
}

/**
 * Final real follower score
 * realScore = qualityScore × farmPenalty × log10(followers + 10)
 */
export function realFollowerScore(
  qualityScore: number,
  penalty: number,
  followers: number
): number {
  return qualityScore * penalty * Math.log10(followers + 10);
}
