/**
 * BLOCK 18 - Follower Cluster Service
 * 
 * Clusters followers to detect farms
 */

import type { Db, Collection, Document } from 'mongodb';
import { identityHash, isFarmCluster, getFarmLevel, type FarmLevel, type ClusterStats } from '../formulas/identity-hash.js';

export interface FollowerClusterReport {
  actorId: string;
  totalFollowers: number;
  clusters: number;
  farmClusters: number;
  farmScore: number;
  reuseScore: number;
  label: FarmLevel;
  topClusters: ClusterStats[];
  updatedAt: string;
}

export class FollowerClusterService {
  private followerNodes: Collection<Document>;
  private followerReuse: Collection<Document>;
  private reports: Collection<Document>;

  constructor(private db: Db) {
    this.followerNodes = db.collection('follower_nodes');
    this.followerReuse = db.collection('follower_reuse');
    this.reports = db.collection('follower_cluster_reports');
  }

  /**
   * Analyze follower clusters for an actor
   */
  async analyze(actorId: string): Promise<FollowerClusterReport> {
    // Load followers
    const followers = await this.loadFollowers(actorId);

    // Build clusters by hash
    const clusterMap = new Map<string, any[]>();
    for (const f of followers) {
      const hash = identityHash({
        followerId: f.followerId,
        accountAgeDays: f.accountAgeDays || 0,
        followers: f.followers || 0,
        following: f.following || 0,
        tweetsTotal: f.tweetsTotal || 0,
        tweetsLast30d: f.tweetsLast30d || 0,
        avgLikes: f.avgLikes || 0,
        avgReplies: f.avgReplies || 0,
        bioLength: f.bioLength || 0,
        hasAvatar: f.hasAvatar || false,
        followTs: f.followTs || new Date().toISOString()
      });

      if (!clusterMap.has(hash)) {
        clusterMap.set(hash, []);
      }
      clusterMap.get(hash)!.push(f);
    }

    // Build cluster stats
    const clusters: ClusterStats[] = [];
    for (const [hash, members] of clusterMap) {
      const stats: ClusterStats = {
        hash,
        size: members.length,
        avgAccountAge: members.reduce((s, m) => s + (m.accountAgeDays || 0), 0) / members.length,
        avgTweets: members.reduce((s, m) => s + (m.tweetsTotal || 0), 0) / members.length,
        followTimeSpreadHours: this.calculateTimeSpread(members)
      };
      clusters.push(stats);
    }

    // Identify farm clusters
    const farmClusters = clusters.filter(isFarmCluster);
    const farmFollowers = farmClusters.reduce((s, c) => s + c.size, 0);

    // Calculate reuse score
    const reuseScore = await this.computeReuseScore(followers.map(f => f.followerId));

    // Calculate farm score
    const farmScore = followers.length > 0 ? farmFollowers / followers.length : 0;
    const label = getFarmLevel(farmScore);

    const report: FollowerClusterReport = {
      actorId,
      totalFollowers: followers.length,
      clusters: clusters.length,
      farmClusters: farmClusters.length,
      farmScore: Math.round(farmScore * 100) / 100,
      reuseScore: Math.round(reuseScore * 100) / 100,
      label,
      topClusters: clusters.sort((a, b) => b.size - a.size).slice(0, 10),
      updatedAt: new Date().toISOString()
    };

    // Cache report
    await this.reports.updateOne(
      { actorId },
      { $set: report },
      { upsert: true }
    );

    return report;
  }

  /**
   * Get cached report
   */
  async get(actorId: string): Promise<FollowerClusterReport | null> {
    const doc = await this.reports.findOne({ actorId });
    return doc as unknown as FollowerClusterReport | null;
  }

  /**
   * Load followers with features
   */
  private async loadFollowers(actorId: string): Promise<any[]> {
    return this.followerNodes
      .find({ actorId })
      .limit(5000)
      .toArray();
  }

  /**
   * Calculate time spread in hours
   */
  private calculateTimeSpread(members: any[]): number {
    const times = members
      .map(m => new Date(m.followTs || 0).getTime())
      .filter(t => t > 0);

    if (times.length < 2) return 0;

    const min = Math.min(...times);
    const max = Math.max(...times);
    return (max - min) / 3600000; // Convert to hours
  }

  /**
   * Compute reuse score (followers shared with other actors)
   */
  private async computeReuseScore(followerIds: string[]): Promise<number> {
    if (!followerIds.length) return 0;

    const reused = await this.followerReuse.countDocuments({
      followerId: { $in: followerIds },
      $expr: { $gte: [{ $size: '$followedActors' }, 2] }
    });

    return reused / followerIds.length;
  }
}
