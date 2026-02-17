/**
 * Twitter Narrative Detection Service
 * Детекция нарративов из твитов (cashtags, keywords, topics)
 */

import { Db } from 'mongodb';
import { NarrativeService } from './narrative.service.js';
import { Narrative, NarrativeAtom, NarrativeState } from '../models/narrative.types.js';

// Predefined narrative patterns
const NARRATIVE_PATTERNS: Record<string, { keywords: string[]; tokens: string[] }> = {
  AI_AGENTS: {
    keywords: ['ai agent', 'autonomous agent', 'ai agents', 'agent protocol', 'defi ai', 'ai defi'],
    tokens: ['FET', 'AGIX', 'RNDR', 'TAO', 'OCEAN', 'NMR', 'VIRTUAL'],
  },
  RWA_TOKENIZATION: {
    keywords: ['rwa', 'real world asset', 'tokenized asset', 'treasury', 'tokenization'],
    tokens: ['ONDO', 'PENDLE', 'MKR', 'CFG', 'MPL', 'MAPLE'],
  },
  RESTAKING: {
    keywords: ['restaking', 'eigenlayer', 'liquid restaking', 'lrt', 'avs'],
    tokens: ['EIGEN', 'LDO', 'RPL', 'ETHFI', 'PUFFER', 'RENZO'],
  },
  DEPIN: {
    keywords: ['depin', 'decentralized physical', 'physical infrastructure', 'iot blockchain'],
    tokens: ['HNT', 'RNDR', 'FIL', 'AR', 'IOTX', 'DIMO'],
  },
  BTC_L2: {
    keywords: ['bitcoin l2', 'btc layer 2', 'ordinals', 'runes', 'brc20', 'btc defi'],
    tokens: ['STX', 'ORDI', 'RUNE', 'SATS', 'ALEX'],
  },
  MEME_COINS: {
    keywords: ['meme coin', 'memecoin', 'pump fun', 'degen', '100x'],
    tokens: ['PEPE', 'WIF', 'BONK', 'FLOKI', 'SHIB', 'DOGE'],
  },
  GAMING: {
    keywords: ['gaming', 'gamefi', 'play to earn', 'p2e', 'metaverse gaming'],
    tokens: ['IMX', 'GALA', 'AXS', 'SAND', 'MANA', 'ILV'],
  },
  MODULAR: {
    keywords: ['modular', 'data availability', 'celestia', 'rollup', 'da layer'],
    tokens: ['TIA', 'MANTA', 'DYM', 'ALT'],
  },
};

// Cashtag pattern
const CASHTAG_REGEX = /\$([A-Z]{2,10})\b/g;
const KEYWORD_MIN_LENGTH = 3;

export interface TweetData {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  createdAt: Date;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface DetectionResult {
  narratives: string[];
  tokens: string[];
  atoms: string[];
  confidence: number;
}

export class TwitterNarrativeDetectionService {
  private narrativeService: NarrativeService;

  constructor(private db: Db) {
    this.narrativeService = new NarrativeService(db);
  }

  /**
   * Extract cashtags from tweet text
   */
  extractCashtags(text: string): string[] {
    const matches = text.match(CASHTAG_REGEX) || [];
    return matches.map(m => m.replace('$', '').toUpperCase());
  }

  /**
   * Detect narratives from tweet text
   */
  detectNarratives(text: string): string[] {
    const lowerText = text.toLowerCase();
    const detected: string[] = [];

    for (const [narrativeKey, pattern] of Object.entries(NARRATIVE_PATTERNS)) {
      for (const keyword of pattern.keywords) {
        if (lowerText.includes(keyword)) {
          detected.push(narrativeKey);
          break;
        }
      }
    }

    return [...new Set(detected)];
  }

  /**
   * Match tokens to narratives
   */
  matchTokensToNarratives(tokens: string[]): string[] {
    const narratives: string[] = [];

    for (const token of tokens) {
      for (const [narrativeKey, pattern] of Object.entries(NARRATIVE_PATTERNS)) {
        if (pattern.tokens.includes(token)) {
          narratives.push(narrativeKey);
        }
      }
    }

    return [...new Set(narratives)];
  }

  /**
   * Process single tweet
   */
  async processTweet(tweet: TweetData): Promise<DetectionResult> {
    const tokens = this.extractCashtags(tweet.text);
    const keywordNarratives = this.detectNarratives(tweet.text);
    const tokenNarratives = this.matchTokensToNarratives(tokens);
    const allNarratives = [...new Set([...keywordNarratives, ...tokenNarratives])];

    // Extract potential new atoms (keywords)
    const words = tweet.text.toLowerCase().split(/\s+/);
    const potentialAtoms = words.filter(w => 
      w.length >= KEYWORD_MIN_LENGTH && 
      !w.startsWith('@') && 
      !w.startsWith('http')
    );

    const confidence = this.calculateConfidence(tweet, allNarratives, tokens);

    // Update narrative atoms
    for (const token of tokens) {
      await this.updateAtom(token, 'token', tweet);
    }

    // Update narrative mentions
    for (const narrativeKey of allNarratives) {
      await this.updateNarrativeMention(narrativeKey, tweet);
    }

    return {
      narratives: allNarratives,
      tokens,
      atoms: potentialAtoms.slice(0, 10),
      confidence,
    };
  }

  /**
   * Calculate detection confidence
   */
  private calculateConfidence(
    tweet: TweetData,
    narratives: string[],
    tokens: string[]
  ): number {
    let score = 0;

    // Base score for having narratives/tokens
    if (narratives.length > 0) score += 0.3;
    if (tokens.length > 0) score += 0.2;
    if (narratives.length >= 2) score += 0.1;

    // Engagement boost
    if (tweet.metrics) {
      const engagement = tweet.metrics.likes + tweet.metrics.retweets * 2;
      if (engagement > 100) score += 0.2;
      if (engagement > 1000) score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * Update narrative atom (token/keyword tracking)
   */
  private async updateAtom(keyword: string, type: 'token' | 'topic' | 'concept', tweet: TweetData): Promise<void> {
    await this.db.collection('narrative_atoms').updateOne(
      { keyword: keyword.toUpperCase() },
      {
        $inc: { mentionsCount: 1 },
        $addToSet: { authors: tweet.authorId },
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          keyword: keyword.toUpperCase(),
          type,
          firstSeenAt: new Date(),
          weightedAttention: 0,
        },
      },
      { upsert: true }
    );
  }

  /**
   * Update narrative mention count and recalculate NMS
   */
  private async updateNarrativeMention(narrativeKey: string, tweet: TweetData): Promise<void> {
    // Record mention
    await this.db.collection('narrative_mentions').insertOne({
      narrativeKey,
      tweetId: tweet.id,
      authorId: tweet.authorId,
      authorUsername: tweet.authorUsername,
      timestamp: new Date(),
      metrics: tweet.metrics,
    });

    // Update narrative velocity
    const recentMentions = await this.db.collection('narrative_mentions')
      .countDocuments({
        narrativeKey,
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
      });

    const previousMentions = await this.db.collection('narrative_mentions')
      .countDocuments({
        narrativeKey,
        timestamp: {
          $gte: new Date(Date.now() - 2 * 60 * 60 * 1000),
          $lt: new Date(Date.now() - 60 * 60 * 1000),
        },
      });

    const velocity = previousMentions > 0 
      ? ((recentMentions - previousMentions) / previousMentions) * 100 
      : recentMentions * 10;

    // Update narrative
    await this.db.collection('narratives').updateOne(
      { key: narrativeKey },
      {
        $set: {
          velocity: Math.max(0, velocity),
          updatedAt: new Date(),
        },
        $inc: { totalMentions: 1 },
      }
    );
  }

  /**
   * Batch process tweets
   */
  async processTweetBatch(tweets: TweetData[]): Promise<{ processed: number; narratives: Map<string, number> }> {
    const narrativeCounts = new Map<string, number>();

    for (const tweet of tweets) {
      try {
        const result = await this.processTweet(tweet);
        for (const n of result.narratives) {
          narrativeCounts.set(n, (narrativeCounts.get(n) || 0) + 1);
        }
      } catch (err) {
        console.error(`[NarrativeDetection] Error processing tweet ${tweet.id}:`, err);
      }
    }

    return { processed: tweets.length, narratives: narrativeCounts };
  }

  /**
   * Recalculate NMS for all narratives
   */
  async recalculateAllNMS(): Promise<void> {
    const narratives = await this.db.collection('narratives').find({}).toArray();

    for (const n of narratives) {
      const hourlyMentions = await this.db.collection('narrative_mentions')
        .countDocuments({
          narrativeKey: n.key,
          timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
        });

      const uniqueAuthors = await this.db.collection('narrative_mentions')
        .distinct('authorId', {
          narrativeKey: n.key,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });

      const velocity = Math.min(100, hourlyMentions * 5);
      const influencerWeight = Math.min(1, uniqueAuthors.length / 20);

      const nms = this.narrativeService.calculateNMS(
        velocity,
        influencerWeight,
        n.clusterSpread || 0.5,
        n.noveltyFactor || 0.5
      );

      // Determine state
      const firstSeen = n.createdAt || new Date();
      const ageHours = (Date.now() - new Date(firstSeen).getTime()) / (1000 * 60 * 60);
      const state = this.narrativeService.classifyState(nms, ageHours);

      await this.db.collection('narratives').updateOne(
        { key: n.key },
        {
          $set: {
            nms,
            velocity,
            influencerWeight,
            state,
            updatedAt: new Date(),
          },
        }
      );
    }
  }

  /**
   * Get narrative patterns (for admin/debug)
   */
  getNarrativePatterns(): typeof NARRATIVE_PATTERNS {
    return NARRATIVE_PATTERNS;
  }
}
