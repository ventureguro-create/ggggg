/**
 * БЛОК 2 - Token Mention Index Service
 * БЛОК 3 - Coordinated Momentum Service
 * Tracks token mentions by clusters and calculates momentum
 */

import { Db } from 'mongodb';
import {
  TokenMention,
  ClusterTokenAttention,
  ClusterTokenMomentum,
  TimeWindow,
  MomentumLevel,
} from './cluster.types.js';
import { clusterExtractionService } from './cluster-extraction.service.js';

// Time windows in milliseconds
const WINDOWS: Record<TimeWindow, number> = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// Momentum thresholds
const MOMENTUM_THRESHOLDS = {
  BACKGROUND: 0.2,
  ATTENTION: 0.5,
  MOMENTUM: 1.0,
};

export class TokenAttentionService {
  private db: Db | null = null;

  setDb(db: Db) {
    this.db = db;
    clusterExtractionService.setDb(db);
  }

  /**
   * БЛОК 2: Compute attention scores for all cluster-token pairs
   */
  async computeAttention(window: TimeWindow): Promise<ClusterTokenAttention[]> {
    if (!this.db) throw new Error('Database not initialized');

    console.log(`[TokenAttention] Computing attention for window: ${window}`);

    // Get clusters
    const clusters = await clusterExtractionService.getClusters();
    if (clusters.length === 0) {
      console.log('[TokenAttention] No clusters found, rebuilding...');
      await clusterExtractionService.buildClusters();
    }

    // Get token mentions from parsed tweets
    const mentions = await this.getTokenMentions(window);
    console.log(`[TokenAttention] Found ${mentions.length} token mentions in ${window}`);

    // Aggregate by cluster and token
    const attentionMap = new Map<string, ClusterTokenAttention>();

    for (const mention of mentions) {
      // Find which cluster this actor belongs to
      const cluster = await clusterExtractionService.findClusterByMember(mention.actorId);
      if (!cluster) continue;

      const key = `${cluster.id}:${mention.token}`;
      
      if (!attentionMap.has(key)) {
        attentionMap.set(key, {
          clusterId: cluster.id,
          token: mention.token,
          window,
          mentions: 0,
          uniqueActors: 0,
          attentionScore: 0,
          avgAuthority: 0,
          cohesion: cluster.metrics.cohesion,
          lastUpdated: new Date(),
        });
      }

      const attention = attentionMap.get(key)!;
      attention.mentions++;
      attention.attentionScore += mention.weight * (mention.authority || 0.5);
    }

    // Calculate unique actors and normalize
    const results = Array.from(attentionMap.values()).map(a => {
      // Apply time decay and cohesion
      a.attentionScore = a.attentionScore * a.cohesion;
      a.avgAuthority = a.attentionScore / Math.max(a.mentions, 1);
      return a;
    });

    // Save to database
    await this.saveAttention(results, window);

    return results;
  }

  /**
   * Get token mentions from parsed tweets
   */
  private async getTokenMentions(window: TimeWindow): Promise<TokenMention[]> {
    const windowMs = WINDOWS[window];
    const since = new Date(Date.now() - windowMs);

    const mentions: TokenMention[] = [];

    // Check twitter_parsed_tweets collection first
    const twitterParsedTweets = await this.db!.collection('twitter_parsed_tweets')
      .find({
        createdAt: { $gte: since },
      })
      .limit(5000)
      .toArray();

    for (const tweet of twitterParsedTweets) {
      const tokens = tweet.tokens || this.extractCashtags(tweet.text || '');
      for (const token of tokens) {
        mentions.push({
          token: (typeof token === 'string' ? token : token.symbol || token).toUpperCase().replace('$', ''),
          actorId: (tweet.username || tweet.authorId || '').toLowerCase(),
          timestamp: tweet.createdAt,
          weight: this.calculateEngagementWeight(tweet),
          tweetId: tweet._id?.toString() || '',
          reach: tweet.impressions || 0,
          authority: tweet.authorAuthority || 0.5,
        });
      }
    }

    // Get tweets with token mentions from parsed_tweets
    const tweets = await this.db!.collection('parsed_tweets')
      .find({
        parsedAt: { $gte: since },
        'tokens.0': { $exists: true }, // Has at least one token
      })
      .limit(5000)
      .toArray();

    for (const tweet of tweets) {
      const tokens = tweet.tokens || [];
      for (const token of tokens) {
        mentions.push({
          token: token.symbol || token,
          actorId: tweet.username?.toLowerCase() || tweet.authorId,
          timestamp: tweet.parsedAt || tweet.createdAt,
          weight: this.calculateEngagementWeight(tweet),
          tweetId: tweet.tweetId || tweet._id.toString(),
          reach: tweet.metrics?.impressions || 0,
          authority: tweet.authorAuthority || 0.5,
        });
      }
    }

    // Also check for cashtags in tweet text
    const rawTweets = await this.db!.collection('parser_tweets')
      .find({ createdAt: { $gte: since } })
      .limit(3000)
      .toArray();

    for (const tweet of rawTweets) {
      const cashtags = this.extractCashtags(tweet.text || tweet.content || '');
      for (const token of cashtags) {
        mentions.push({
          token,
          actorId: tweet.username?.toLowerCase() || tweet.authorUsername?.toLowerCase(),
          timestamp: tweet.createdAt,
          weight: this.calculateEngagementWeight(tweet),
          tweetId: tweet.id || tweet._id.toString(),
        });
      }
    }

    return mentions;
  }

  private extractCashtags(text: string): string[] {
    const matches = text.match(/\$[A-Z]{2,10}/gi) || [];
    return [...new Set(matches.map(m => m.toUpperCase()))];
  }

  private calculateEngagementWeight(tweet: any): number {
    const likes = tweet.likes || tweet.likeCount || 0;
    const reposts = tweet.reposts || tweet.retweetCount || 0;
    const replies = tweet.replies || tweet.replyCount || 0;
    
    return Math.log(1 + likes * 1.0 + reposts * 1.5 + replies * 0.5);
  }

  private async saveAttention(results: ClusterTokenAttention[], window: TimeWindow): Promise<void> {
    const collection = this.db!.collection('cluster_token_attention');

    // Upsert each result
    for (const r of results) {
      await collection.updateOne(
        { clusterId: r.clusterId, token: r.token, window },
        { $set: r },
        { upsert: true }
      );
    }

    console.log(`[TokenAttention] Saved ${results.length} attention records for ${window}`);
  }

  /**
   * БЛОК 3: Compute momentum scores
   */
  async computeMomentum(): Promise<ClusterTokenMomentum[]> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('[TokenMomentum] Computing momentum scores...');

    // Get attention for both windows
    const attention1h = await this.getAttentionByWindow('1h');
    const attention4h = await this.getAttentionByWindow('4h');

    // Build lookup map for 4h
    const attention4hMap = new Map<string, ClusterTokenAttention>();
    for (const a of attention4h) {
      attention4hMap.set(`${a.clusterId}:${a.token}`, a);
    }

    const results: ClusterTokenMomentum[] = [];

    for (const a1h of attention1h) {
      const key = `${a1h.clusterId}:${a1h.token}`;
      const a4h = attention4hMap.get(key);

      // Skip if no 4h data or zero score
      if (!a4h || a4h.attentionScore === 0) continue;

      // Calculate velocity and acceleration
      const velocity = a1h.attentionScore / a4h.attentionScore;
      const acceleration = (a1h.attentionScore - a4h.attentionScore) / a4h.attentionScore;

      // Calculate CMS (Coordinated Momentum Score)
      const cms = acceleration * Math.log(1 + a1h.uniqueActors) * a1h.cohesion;

      // Classify level
      let level: MomentumLevel = 'BACKGROUND';
      if (cms >= MOMENTUM_THRESHOLDS.MOMENTUM) level = 'PUMP_LIKE';
      else if (cms >= MOMENTUM_THRESHOLDS.ATTENTION) level = 'MOMENTUM';
      else if (cms >= MOMENTUM_THRESHOLDS.BACKGROUND) level = 'ATTENTION';

      results.push({
        clusterId: a1h.clusterId,
        token: a1h.token,
        window: '1h',
        velocity,
        acceleration,
        momentumScore: cms,
        uniqueActors: a1h.uniqueActors,
        cohesion: a1h.cohesion,
        level,
        lastUpdated: new Date(),
      });
    }

    // Save momentum
    await this.saveMomentum(results);

    console.log(`[TokenMomentum] Computed ${results.length} momentum scores`);
    return results;
  }

  private async getAttentionByWindow(window: TimeWindow): Promise<ClusterTokenAttention[]> {
    return this.db!.collection('cluster_token_attention')
      .find({ window })
      .toArray() as Promise<ClusterTokenAttention[]>;
  }

  private async saveMomentum(results: ClusterTokenMomentum[]): Promise<void> {
    const collection = this.db!.collection('cluster_token_momentum');

    for (const r of results) {
      await collection.updateOne(
        { clusterId: r.clusterId, token: r.token },
        { $set: r },
        { upsert: true }
      );
    }

    // Create indexes
    await collection.createIndex({ token: 1, momentumScore: -1 });
    await collection.createIndex({ level: 1, momentumScore: -1 });
  }

  /**
   * Get top momentum tokens
   */
  async getTopMomentum(minLevel?: MomentumLevel): Promise<ClusterTokenMomentum[]> {
    if (!this.db) return [];

    const query: any = {};
    if (minLevel) {
      const levels: MomentumLevel[] = ['BACKGROUND', 'ATTENTION', 'MOMENTUM', 'PUMP_LIKE'];
      const minIndex = levels.indexOf(minLevel);
      query.level = { $in: levels.slice(minIndex) };
    }

    return this.db.collection('cluster_token_momentum')
      .find(query)
      .sort({ momentumScore: -1 })
      .limit(50)
      .toArray() as Promise<ClusterTokenMomentum[]>;
  }

  /**
   * Get momentum for specific token
   */
  async getTokenMomentum(token: string): Promise<ClusterTokenMomentum[]> {
    if (!this.db) return [];
    return this.db.collection('cluster_token_momentum')
      .find({ token: token.toUpperCase() })
      .sort({ momentumScore: -1 })
      .toArray() as Promise<ClusterTokenMomentum[]>;
  }

  /**
   * Get attention for specific cluster
   */
  async getClusterAttention(clusterId: string): Promise<ClusterTokenAttention[]> {
    if (!this.db) return [];
    return this.db.collection('cluster_token_attention')
      .find({ clusterId })
      .sort({ attentionScore: -1 })
      .toArray() as Promise<ClusterTokenAttention[]>;
  }
}

export const tokenAttentionService = new TokenAttentionService();
