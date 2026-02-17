/**
 * Twitter Parser Integration Service
 * Интеграция Twitter Parser V2 с Narrative Detection
 */

import { Db } from 'mongodb';
import { TwitterNarrativeDetectionService, TweetData } from '../../narratives/services/twitter-narrative-detection.service.js';

const PARSER_URL = process.env.TWITTER_PARSER_URL || 'http://localhost:5001';

export interface ParsedTweet {
  id: string;
  text: string;
  user: {
    id?: string;
    username: string;
    name?: string;
    followers_count?: number;
  };
  created_at?: string;
  retweet_count?: number;
  favorite_count?: number;
  reply_count?: number;
}

export interface SearchResult {
  tweets: ParsedTweet[];
  query: string;
  timestamp: Date;
}

export class TwitterParserIntegrationService {
  private detectionService: TwitterNarrativeDetectionService;
  private isPolling = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(private db: Db) {
    this.detectionService = new TwitterNarrativeDetectionService(db);
  }

  /**
   * Search tweets and process for narratives
   */
  async searchAndProcess(
    keyword: string,
    limit = 20,
    sessionId?: string
  ): Promise<{ tweets: number; narratives: Record<string, number> }> {
    console.log(`[ParserIntegration] Searching: "${keyword}" limit=${limit}`);

    // Get active session credentials
    const credentials = await this.getSessionCredentials(sessionId);
    if (!credentials) {
      throw new Error('No active Twitter session available');
    }

    // Call parser
    const response = await fetch(`${PARSER_URL}/search/${encodeURIComponent(keyword)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit,
        cookies: credentials.cookies,
        proxyUrl: credentials.proxyUrl,
        userAgent: credentials.userAgent,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Parser error: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    if (!result.ok || !result.data?.tweets) {
      throw new Error('Invalid parser response');
    }

    // Convert and process tweets
    const tweetData = this.convertTweets(result.data.tweets);
    const processed = await this.detectionService.processTweetBatch(tweetData);

    // Save raw tweets for reference
    await this.saveRawTweets(result.data.tweets, keyword);

    console.log(`[ParserIntegration] Processed ${processed.processed} tweets, found narratives:`, 
      Object.fromEntries(processed.narratives));

    return {
      tweets: processed.processed,
      narratives: Object.fromEntries(processed.narratives),
    };
  }

  /**
   * Get user tweets and process
   */
  async getUserTweetsAndProcess(
    username: string,
    limit = 20,
    sessionId?: string
  ): Promise<{ tweets: number; narratives: Record<string, number> }> {
    console.log(`[ParserIntegration] Getting tweets for @${username}`);

    const credentials = await this.getSessionCredentials(sessionId);
    if (!credentials) {
      throw new Error('No active Twitter session available');
    }

    const response = await fetch(`${PARSER_URL}/tweets/${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit,
        cookies: credentials.cookies,
        proxyUrl: credentials.proxyUrl,
        userAgent: credentials.userAgent,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Parser error: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    if (!result.ok || !result.data?.tweets) {
      throw new Error('Invalid parser response');
    }

    const tweetData = this.convertTweets(result.data.tweets);
    const processed = await this.detectionService.processTweetBatch(tweetData);

    await this.saveRawTweets(result.data.tweets, `@${username}`);

    return {
      tweets: processed.processed,
      narratives: Object.fromEntries(processed.narratives),
    };
  }

  /**
   * Process tweets from webhook (called by parser after completing task)
   */
  async processWebhook(payload: { tweets: ParsedTweet[]; source: string }): Promise<void> {
    console.log(`[ParserIntegration] Webhook: ${payload.tweets.length} tweets from ${payload.source}`);

    const tweetData = this.convertTweets(payload.tweets);
    await this.detectionService.processTweetBatch(tweetData);
    await this.saveRawTweets(payload.tweets, payload.source);
  }

  /**
   * Start polling for new parsed tweets
   */
  startPolling(intervalMs = 60000): void {
    if (this.isPolling) {
      console.log('[ParserIntegration] Polling already running');
      return;
    }

    console.log(`[ParserIntegration] Starting polling every ${intervalMs}ms`);
    this.isPolling = true;

    // Run immediately then on interval
    this.pollNewTweets();
    this.pollingInterval = setInterval(() => this.pollNewTweets(), intervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('[ParserIntegration] Polling stopped');
  }

  /**
   * Poll for unprocessed tweets
   */
  private async pollNewTweets(): Promise<void> {
    try {
      // Get unprocessed tweets from raw_tweets collection
      const unprocessed = await this.db.collection('raw_tweets')
        .find({ narrativeProcessed: { $ne: true } })
        .limit(100)
        .toArray();

      if (unprocessed.length === 0) return;

      console.log(`[ParserIntegration] Processing ${unprocessed.length} unprocessed tweets`);

      const tweetData: TweetData[] = unprocessed.map(t => ({
        id: t.tweetId || t.id,
        text: t.text || '',
        authorId: t.user?.id || t.authorId || 'unknown',
        authorUsername: t.user?.username || t.authorUsername || 'unknown',
        createdAt: t.created_at ? new Date(t.created_at) : new Date(),
        metrics: {
          likes: t.favorite_count || 0,
          retweets: t.retweet_count || 0,
          replies: t.reply_count || 0,
        },
      }));

      await this.detectionService.processTweetBatch(tweetData);

      // Mark as processed
      const ids = unprocessed.map(t => t._id);
      await this.db.collection('raw_tweets').updateMany(
        { _id: { $in: ids } },
        { $set: { narrativeProcessed: true, narrativeProcessedAt: new Date() } }
      );

    } catch (err) {
      console.error('[ParserIntegration] Poll error:', err);
    }
  }

  /**
   * Get session credentials from backend
   */
  private async getSessionCredentials(sessionId?: string): Promise<{
    cookies: any[];
    proxyUrl?: string;
    userAgent?: string;
  } | null> {
    // Try to get from twitter_sessions collection
    const query: any = { status: 'ACTIVE' };
    if (sessionId) {
      query._id = sessionId;
    }

    const session = await this.db.collection('twitter_sessions')
      .findOne(query, { sort: { lastUsedAt: -1 } });

    if (!session) {
      console.warn('[ParserIntegration] No active session found');
      return null;
    }

    // Decrypt cookies if encrypted
    let cookies = session.cookies;
    if (session.encryptedCookies && !cookies) {
      // Cookies are encrypted - need to decrypt via backend service
      // For now, try to use raw cookies if available
      console.warn('[ParserIntegration] Encrypted cookies - using session directly');
    }

    return {
      cookies: cookies || [],
      proxyUrl: session.proxyUrl,
      userAgent: session.userAgent,
    };
  }

  /**
   * Convert parsed tweets to TweetData format
   */
  private convertTweets(tweets: ParsedTweet[]): TweetData[] {
    return tweets.map(t => ({
      id: t.id,
      text: t.text,
      authorId: t.user?.id || 'unknown',
      authorUsername: t.user?.username || 'unknown',
      createdAt: t.created_at ? new Date(t.created_at) : new Date(),
      metrics: {
        likes: t.favorite_count || 0,
        retweets: t.retweet_count || 0,
        replies: t.reply_count || 0,
      },
    }));
  }

  /**
   * Save raw tweets for reference
   */
  private async saveRawTweets(tweets: ParsedTweet[], source: string): Promise<void> {
    if (tweets.length === 0) return;

    const docs = tweets.map(t => ({
      tweetId: t.id,
      text: t.text,
      user: t.user,
      created_at: t.created_at,
      retweet_count: t.retweet_count,
      favorite_count: t.favorite_count,
      reply_count: t.reply_count,
      source,
      fetchedAt: new Date(),
      narrativeProcessed: true, // Already processed
      narrativeProcessedAt: new Date(),
    }));

    try {
      await this.db.collection('raw_tweets').insertMany(docs, { ordered: false });
    } catch (err: any) {
      // Ignore duplicate key errors
      if (!err.message?.includes('duplicate key')) {
        console.error('[ParserIntegration] Save tweets error:', err.message);
      }
    }
  }

  /**
   * Get integration status
   */
  async getStatus(): Promise<{
    parserHealth: boolean;
    activeSessions: number;
    unprocessedTweets: number;
    isPolling: boolean;
  }> {
    // Check parser health
    let parserHealth = false;
    try {
      const res = await fetch(`${PARSER_URL}/health`, { method: 'GET' });
      const data = await res.json();
      parserHealth = data.ok === true;
    } catch {
      parserHealth = false;
    }

    // Count active sessions
    const activeSessions = await this.db.collection('twitter_sessions')
      .countDocuments({ status: 'ACTIVE' });

    // Count unprocessed tweets
    const unprocessedTweets = await this.db.collection('raw_tweets')
      .countDocuments({ narrativeProcessed: { $ne: true } });

    return {
      parserHealth,
      activeSessions,
      unprocessedTweets,
      isPolling: this.isPolling,
    };
  }
}
