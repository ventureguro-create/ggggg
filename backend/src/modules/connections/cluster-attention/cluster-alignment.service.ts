/**
 * БЛОК 4 - Cluster Price Alignment Service
 * БЛОК 5 - Cluster Credibility Service  
 * БЛОК 6 - Token Momentum Score Service
 * 
 * Connects cluster momentum to price movement and builds reputation
 */

import { Db } from 'mongodb';
import {
  ClusterPriceAlignment,
  ClusterCredibility,
  TokenMomentum,
  AlignmentVerdict,
  Horizon,
  ClusterTokenMomentum,
} from './cluster.types.js';
import { tokenAttentionService } from './token-attention.service.js';

// Alignment thresholds
const ALIGNMENT_THRESHOLDS = {
  CONFIRMED: 0.6,
  LAGGING: 0.2,
};

export class ClusterAlignmentService {
  private db: Db | null = null;

  setDb(db: Db) {
    this.db = db;
  }

  // ============================
  // БЛОК 4 - Price Alignment
  // ============================

  /**
   * Evaluate alignment between momentum and price movement
   */
  async evaluateAlignment(
    clusterId: string,
    token: string,
    momentumScore: number,
    horizon: Horizon = '1h'
  ): Promise<ClusterPriceAlignment> {
    if (!this.db) throw new Error('Database not initialized');

    // Get price data (mock for now - will be connected to Exchange Layer)
    const priceData = await this.getPriceData(token, horizon);
    
    const priceReturn = priceData.return;
    const volatility = priceData.volatility || 0.02; // Default 2%
    
    // Normalized impact
    const impact = volatility > 0 ? priceReturn / volatility : 0;
    
    // Alignment score: positive if momentum direction matches price direction
    const alignmentScore = Math.sign(momentumScore) === Math.sign(priceReturn)
      ? Math.abs(impact)
      : -Math.abs(impact);
    
    // Determine verdict
    let verdict: AlignmentVerdict = 'NO_IMPACT';
    if (alignmentScore > ALIGNMENT_THRESHOLDS.CONFIRMED) {
      verdict = 'CONFIRMED';
    } else if (alignmentScore > ALIGNMENT_THRESHOLDS.LAGGING) {
      verdict = 'LAGGING';
    }

    const alignment: ClusterPriceAlignment = {
      clusterId,
      token,
      momentumScore,
      priceReturn,
      volatility,
      impact,
      alignmentScore,
      verdict,
      horizon,
      timestamp: new Date(),
    };

    // Save to database
    await this.saveAlignment(alignment);

    return alignment;
  }

  /**
   * Get price data for token (placeholder - connect to Exchange Layer)
   */
  private async getPriceData(token: string, horizon: Horizon): Promise<{ return: number; volatility: number }> {
    // Try to get from token_prices collection if exists
    try {
      const prices = await this.db!.collection('token_prices')
        .find({ symbol: token.toUpperCase() })
        .sort({ timestamp: -1 })
        .limit(2)
        .toArray();

      if (prices.length >= 2) {
        const currentPrice = prices[0].price;
        const previousPrice = prices[1].price;
        return {
          return: (currentPrice - previousPrice) / previousPrice,
          volatility: 0.02,
        };
      }
    } catch (e) {
      // Collection doesn't exist
    }

    // Mock data for testing
    return {
      return: (Math.random() - 0.5) * 0.1, // Random -5% to +5%
      volatility: 0.02,
    };
  }

  private async saveAlignment(alignment: ClusterPriceAlignment): Promise<void> {
    await this.db!.collection('cluster_price_alignment').updateOne(
      { clusterId: alignment.clusterId, token: alignment.token, horizon: alignment.horizon },
      { $set: alignment },
      { upsert: true }
    );
  }

  /**
   * Evaluate all momentum signals
   */
  async evaluateAllMomentum(): Promise<ClusterPriceAlignment[]> {
    if (!this.db) throw new Error('Database not initialized');

    const momentum = await this.db.collection('cluster_token_momentum')
      .find({ level: { $in: ['ATTENTION', 'MOMENTUM', 'PUMP_LIKE'] } })
      .toArray() as ClusterTokenMomentum[];

    const results: ClusterPriceAlignment[] = [];

    for (const m of momentum) {
      const alignment = await this.evaluateAlignment(
        m.clusterId,
        m.token,
        m.momentumScore,
        '1h'
      );
      results.push(alignment);
    }

    console.log(`[Alignment] Evaluated ${results.length} momentum signals`);
    return results;
  }

  /**
   * Get alignments by verdict
   */
  async getAlignments(verdict?: AlignmentVerdict): Promise<ClusterPriceAlignment[]> {
    if (!this.db) return [];
    
    const query = verdict ? { verdict } : {};
    return this.db.collection('cluster_price_alignment')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray() as Promise<ClusterPriceAlignment[]>;
  }

  // ============================
  // БЛОК 5 - Cluster Credibility
  // ============================

  /**
   * Compute credibility score for a cluster
   */
  async computeCredibility(clusterId: string): Promise<ClusterCredibility> {
    if (!this.db) throw new Error('Database not initialized');

    // Get all alignments for this cluster
    const alignments = await this.db.collection('cluster_price_alignment')
      .find({ clusterId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray() as ClusterPriceAlignment[];

    if (alignments.length === 0) {
      return {
        clusterId,
        score: 0.5, // Neutral default
        confirmationRate: 0,
        avgImpact: 0,
        consistency: 0,
        totalEvents: 0,
        updatedAt: new Date(),
      };
    }

    // Calculate metrics
    const confirmed = alignments.filter(a => a.verdict === 'CONFIRMED');
    const confirmationRate = confirmed.length / alignments.length;

    const avgImpact = confirmed.length > 0
      ? confirmed.reduce((sum, a) => sum + Math.abs(a.impact), 0) / confirmed.length
      : 0;

    // Consistency: look for streaks
    let streaks = 0;
    let currentStreak = 0;
    for (const a of alignments) {
      if (a.verdict === 'CONFIRMED') {
        currentStreak++;
        if (currentStreak >= 2) streaks++;
      } else {
        currentStreak = 0;
      }
    }
    const consistency = alignments.length > 1 ? streaks / (alignments.length - 1) : 0;

    // Recency weight
    const lastConfirmed = confirmed[0];
    const recencyWeight = lastConfirmed
      ? Math.exp(-(Date.now() - new Date(lastConfirmed.timestamp).getTime()) / (24 * 60 * 60 * 1000))
      : 0.5;

    // Final credibility score
    const score = Math.min(1, Math.max(0,
      0.4 * confirmationRate +
      0.3 * Math.min(avgImpact / 2, 1) + // Normalize impact
      0.2 * consistency +
      0.1 * recencyWeight
    ));

    const credibility: ClusterCredibility = {
      clusterId,
      score,
      confirmationRate,
      avgImpact,
      consistency,
      totalEvents: alignments.length,
      lastConfirmedAt: lastConfirmed?.timestamp,
      updatedAt: new Date(),
    };

    // Save
    await this.db.collection('cluster_credibility').updateOne(
      { clusterId },
      { $set: credibility },
      { upsert: true }
    );

    return credibility;
  }

  /**
   * Compute credibility for all clusters
   */
  async computeAllCredibility(): Promise<ClusterCredibility[]> {
    if (!this.db) throw new Error('Database not initialized');

    const clusters = await this.db.collection('influencer_clusters').find({}).toArray();
    const results: ClusterCredibility[] = [];

    for (const cluster of clusters) {
      const cred = await this.computeCredibility(cluster.id);
      results.push(cred);
    }

    console.log(`[Credibility] Computed for ${results.length} clusters`);
    return results;
  }

  /**
   * Get top credible clusters
   */
  async getTopCredibleClusters(minScore: number = 0.5): Promise<ClusterCredibility[]> {
    if (!this.db) return [];
    
    return this.db.collection('cluster_credibility')
      .find({ score: { $gte: minScore } })
      .sort({ score: -1 })
      .limit(20)
      .toArray() as Promise<ClusterCredibility[]>;
  }

  // ============================
  // БЛОК 6 - Token Momentum Score
  // ============================

  /**
   * Compute cluster-weighted momentum score for tokens
   */
  async computeTokenMomentum(): Promise<TokenMomentum[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Get all momentum data
    const momentum = await this.db.collection('cluster_token_momentum')
      .find({})
      .toArray() as ClusterTokenMomentum[];

    // Get cluster credibility
    const credMap = new Map<string, number>();
    const credibility = await this.db.collection('cluster_credibility').find({}).toArray();
    for (const c of credibility) {
      credMap.set(c.clusterId, c.score);
    }

    // Aggregate by token
    const tokenMap = new Map<string, {
      rawMomentum: number;
      clusters: Set<string>;
      confirmedEvents: number;
      weights: number[];
    }>();

    const totalClusters = credibility.length || 1;

    for (const m of momentum) {
      const credScore = credMap.get(m.clusterId) || 0.5;
      const recencyWeight = 1; // Could add time decay
      const weightedImpact = m.momentumScore * credScore * recencyWeight;

      if (!tokenMap.has(m.token)) {
        tokenMap.set(m.token, {
          rawMomentum: 0,
          clusters: new Set(),
          confirmedEvents: 0,
          weights: [],
        });
      }

      const data = tokenMap.get(m.token)!;
      data.rawMomentum += weightedImpact;
      data.clusters.add(m.clusterId);
      data.weights.push(weightedImpact);

      // Count high-level events as "confirmed"
      if (m.level === 'MOMENTUM' || m.level === 'PUMP_LIKE') {
        data.confirmedEvents++;
      }
    }

    // Calculate final scores
    const results: TokenMomentum[] = [];
    const maxMomentum = Math.max(...Array.from(tokenMap.values()).map(d => d.rawMomentum), 1);

    for (const [token, data] of tokenMap) {
      const breadth = data.clusters.size / totalClusters;
      const confirmationRatio = data.weights.length > 0
        ? data.confirmedEvents / data.weights.length
        : 0;
      const normalizedMomentum = data.rawMomentum / maxMomentum;

      // Final score formula (БЛОК 6)
      const score = Math.min(1, Math.max(0,
        0.45 * normalizedMomentum +
        0.25 * breadth +
        0.20 * confirmationRatio +
        0.10 * 1 // recency boost placeholder
      ));

      results.push({
        symbol: token,
        score,
        rawMomentum: data.rawMomentum,
        breadth,
        confirmationRatio,
        activeClusters: data.clusters.size,
        confirmedEvents: data.confirmedEvents,
        updatedAt: new Date(),
      });
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Save to database
    for (const r of results) {
      await this.db.collection('token_momentum').updateOne(
        { symbol: r.symbol },
        { $set: r },
        { upsert: true }
      );
    }

    console.log(`[TokenMomentum] Computed for ${results.length} tokens`);
    return results;
  }

  /**
   * Get top momentum tokens
   */
  async getTopTokens(minScore: number = 0.3): Promise<TokenMomentum[]> {
    if (!this.db) return [];
    
    return this.db.collection('token_momentum')
      .find({ score: { $gte: minScore } })
      .sort({ score: -1 })
      .limit(50)
      .toArray() as Promise<TokenMomentum[]>;
  }

  /**
   * Get momentum for specific token
   */
  async getTokenScore(symbol: string): Promise<TokenMomentum | null> {
    if (!this.db) return null;
    
    return this.db.collection('token_momentum')
      .findOne({ symbol: symbol.toUpperCase() }) as Promise<TokenMomentum | null>;
  }
}

export const clusterAlignmentService = new ClusterAlignmentService();
