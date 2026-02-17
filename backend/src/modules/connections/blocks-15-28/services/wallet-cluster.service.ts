/**
 * BLOCK 26 - Wallet Cluster Service
 * 
 * Groups wallets by behavioral similarity
 */

import type { Db, Collection, Document } from 'mongodb';
import { computeWalletSimilarity, buildWalletClusters, getClusterConfidence, type WalletProfile } from '../formulas/wallet-clustering.js';

export interface WalletClusterReport {
  clusterId: string;
  members: string[];
  confidence: number;
  assets: string[];
  behavior: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  representativeWallet: string;
  updatedAt: string;
}

export class WalletClusterService {
  private walletProfiles: Collection<Document>;
  private walletTransactions: Collection<Document>;
  private clusters: Collection<Document>;

  constructor(private db: Db) {
    this.walletProfiles = db.collection('wallet_profiles');
    this.walletTransactions = db.collection('wallet_transactions');
    this.clusters = db.collection('wallet_actor_clusters');
  }

  /**
   * Cluster wallets by behavior
   */
  async clusterWallets(walletAddresses: string[]): Promise<WalletClusterReport[]> {
    // Load wallet profiles with transactions
    const profiles: WalletProfile[] = [];

    for (const address of walletAddresses) {
      const transactions = await this.walletTransactions
        .find({ address })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      profiles.push({
        address,
        transactions: transactions.map((t: any) => ({
          timestamp: new Date(t.timestamp),
          asset: t.asset,
          direction: t.direction,
          amount: t.amount
        }))
      });
    }

    // Build clusters
    const rawClusters = buildWalletClusters(profiles);

    // Convert to reports
    const reports: WalletClusterReport[] = rawClusters.map((c, i) => {
      const assets = new Set<string>();
      let inCount = 0;
      let outCount = 0;

      for (const m of c.members) {
        for (const t of m.transactions) {
          assets.add(t.asset);
          if (t.direction === 'IN') inCount++;
          else outCount++;
        }
      }

      const behavior: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' =
        inCount > outCount * 1.3 ? 'ACCUMULATION' :
        outCount > inCount * 1.3 ? 'DISTRIBUTION' :
        'NEUTRAL';

      return {
        clusterId: `cluster_${i + 1}`,
        members: c.members.map(m => m.address),
        confidence: Math.round(c.confidence * 100) / 100,
        assets: Array.from(assets),
        behavior,
        representativeWallet: c.representative.address,
        updatedAt: new Date().toISOString()
      };
    });

    // Store clusters
    for (const report of reports) {
      await this.clusters.updateOne(
        { clusterId: report.clusterId },
        { $set: report },
        { upsert: true }
      );
    }

    return reports;
  }

  /**
   * Get clusters for a wallet
   */
  async getClustersForWallet(address: string): Promise<WalletClusterReport[]> {
    const docs = await this.clusters
      .find({ members: address })
      .toArray();

    return docs as unknown as WalletClusterReport[];
  }

  /**
   * Calculate similarity between two wallets
   */
  async getSimilarity(addressA: string, addressB: string): Promise<{
    similarity: number;
    confidence: string;
  }> {
    const txA = await this.walletTransactions.find({ address: addressA }).limit(100).toArray();
    const txB = await this.walletTransactions.find({ address: addressB }).limit(100).toArray();

    const profileA: WalletProfile = {
      address: addressA,
      transactions: txA.map((t: any) => ({
        timestamp: new Date(t.timestamp),
        asset: t.asset,
        direction: t.direction,
        amount: t.amount
      }))
    };

    const profileB: WalletProfile = {
      address: addressB,
      transactions: txB.map((t: any) => ({
        timestamp: new Date(t.timestamp),
        asset: t.asset,
        direction: t.direction,
        amount: t.amount
      }))
    };

    const similarity = computeWalletSimilarity(profileA, profileB);
    const confidence = getClusterConfidence(similarity);

    return {
      similarity: Math.round(similarity * 100) / 100,
      confidence
    };
  }
}
