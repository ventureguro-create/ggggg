/**
 * BLOCK 18 - Follower Identity Clustering
 * 
 * Hash-based clustering of followers to detect farms
 */

export interface FollowerIdentity {
  followerId: string;
  accountAgeDays: number;
  followers: number;
  following: number;
  tweetsTotal: number;
  tweetsLast30d: number;
  avgLikes: number;
  avgReplies: number;
  bioLength: number;
  hasAvatar: boolean;
  followTs: string;
}

function bucket(value: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (value < thresholds[i]) return i;
  }
  return thresholds.length;
}

/**
 * Creates behavioral fingerprint hash for a follower
 * Farms are detected by identical hash combinations
 */
export function identityHash(f: FollowerIdentity): string {
  return [
    bucket(f.accountAgeDays, [7, 30, 90, 365]),
    bucket(f.followers, [10, 50, 200, 1000]),
    bucket(f.following, [10, 50, 200, 1000]),
    bucket(f.tweetsTotal, [5, 20, 100]),
    f.hasAvatar ? 1 : 0,
    bucket(f.avgLikes, [0.2, 1, 5]),
  ].join(':');
}

export interface ClusterStats {
  hash: string;
  size: number;
  avgAccountAge: number;
  avgTweets: number;
  followTimeSpreadHours: number;
}

/**
 * Determines if a cluster is likely a farm
 */
export function isFarmCluster(cluster: ClusterStats): boolean {
  return (
    cluster.size >= 10 &&
    cluster.avgAccountAge < 90 &&
    cluster.followTimeSpreadHours < 12 &&
    cluster.avgTweets < 20
  );
}

export type FarmLevel = 'FARM' | 'PARTIAL_FARM' | 'CLEAN';

export function getFarmLevel(farmScore: number): FarmLevel {
  if (farmScore > 0.3) return 'FARM';
  if (farmScore > 0.1) return 'PARTIAL_FARM';
  return 'CLEAN';
}
