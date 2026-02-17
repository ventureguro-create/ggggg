// Twitter Controller - API v4 Routes (Fastify)
// Integrated with B2 Execution Core

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TwitterService } from './twitter.service.js';
import { getDb } from '../../db/mongodb.js';
import { twitterExecutionAdapter } from './execution/execution.adapter.js';
import { runtimeRegistry } from './runtime/runtime.registry.js';

const service = new TwitterService();

// Initialize execution adapter with DB on first request
let executionInitialized = false;
async function initExecution(): Promise<void> {
  if (executionInitialized) return;
  try {
    const db = getDb();
    twitterExecutionAdapter.initialize(db);
    executionInitialized = true;
    console.log('[Twitter] Execution adapter initialized');
  } catch (err) {
    console.error('[Twitter] Failed to initialize execution adapter:', err);
  }
}

export async function registerTwitterRoutes(app: FastifyInstance): Promise<void> {
  // Initialize execution on startup
  app.addHook('onReady', async () => {
    await initExecution();
  });
  
  // Prefix: /api/v4/twitter

  // ==================== Extension Endpoints ====================
  
  /**
   * GET /api/v4/twitter/accounts
   * Returns accounts for extension sync (uses admin accounts list)
   */
  app.get('/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountService } = await import('./accounts/account.service.js');
      const accounts = await accountService.findAll();
      
      // Map to extension-friendly format
      const extensionAccounts = accounts.map((acc: any) => ({
        id: acc._id?.toString() || acc.id,
        username: acc.username,
        sessionStatus: acc.sessionStatus || 'NO_SESSION',
        label: acc.label || acc.username,
      }));
      
      return reply.send({
        ok: true,
        data: {
          accounts: extensionAccounts,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/v4/twitter/sessions/webhook
   * Alternative endpoint for extension to send cookies (proxies to admin endpoint)
   */
  app.post('/sessions/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sessionService } = await import('./sessions/session.service.js');
      const body = req.body as any;
      
      // Validate API key from Authorization header or body
      const authHeader = req.headers.authorization;
      let apiKey = body.apiKey;
      
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7);
      }
      
      if (!sessionService.validateApiKey(apiKey || '')) {
        return reply.status(401).send({
          ok: false,
          error: 'INVALID_API_KEY',
          hint: 'Check your API key in extension settings',
        });
      }
      
      // Generate sessionId if not provided
      const sessionId = body.sessionId || `admin-${Date.now()}`;
      
      const session = await sessionService.ingestSession({
        sessionId,
        cookies: body.cookies,
        userAgent: body.userAgent,
        accountUsername: body.accountUsername,
        accountId: body.accountId,
      });
      
      return reply.send({
        ok: true,
        data: {
          sessionId: session.sessionId,
          status: session.status,
          sessionVersion: session.version || 1,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/v4/twitter/ingest
   * BROWSER-NATIVE ARCHITECTURE: Extension sends parsed data, backend stores it
   * Backend NEVER fetches from Twitter directly!
   */
  app.post('/ingest', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sessionService } = await import('./sessions/session.service.js');
      const { getDb } = await import('../../db/mongodb.js');
      const body = req.body as any;
      
      // Validate API key
      const authHeader = req.headers.authorization;
      let apiKey = body.apiKey;
      
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7);
      }
      
      if (!sessionService.validateApiKey(apiKey || '')) {
        return reply.status(401).send({
          ok: false,
          error: 'INVALID_API_KEY',
        });
      }
      
      const { type, params, data, source, timestamp } = body;
      
      if (!type || !data) {
        return reply.status(400).send({
          ok: false,
          error: 'Missing type or data',
        });
      }
      
      const db = getDb();
      
      // Store based on type
      if (type === 'SEARCH' && Array.isArray(data)) {
        // Store tweets
        const tweetsCollection = db.collection('parsed_tweets');
        const tweets = data.map((tweet: any) => ({
          ...tweet,
          _parsedAt: new Date(),
          _source: source || 'browser-extension',
          _query: params?.keyword,
        }));
        
        if (tweets.length > 0) {
          await tweetsCollection.insertMany(tweets, { ordered: false }).catch(() => {});
        }
        
        console.log(`[Ingest] Stored ${tweets.length} tweets from browser extension`);
        
        return reply.send({
          ok: true,
          data: {
            type,
            stored: tweets.length,
            timestamp,
          },
        });
      }
      
      if (type === 'PROFILE' && data) {
        // Store profile
        const profilesCollection = db.collection('parsed_profiles');
        await profilesCollection.updateOne(
          { username: data.username },
          { 
            $set: { 
              ...data, 
              _parsedAt: new Date(),
              _source: source || 'browser-extension',
            } 
          },
          { upsert: true }
        );
        
        console.log(`[Ingest] Stored profile @${data.username} from browser extension`);
        
        return reply.send({
          ok: true,
          data: {
            type,
            username: data.username,
            timestamp,
          },
        });
      }
      
      return reply.send({
        ok: true,
        data: { type, received: true },
      });
      
    } catch (error: any) {
      console.error('[Ingest] Error:', error);
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  // ==================== Variant A (Twitter Only) Endpoints ====================
  
  /**
   * GET /api/v4/twitter/contract
   * Returns the locked TwitterPost contract version
   */
  app.get('/contract', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: {
        version: '1.0.0',
        locked: true,
        fields: {
          required: ['tweet_id', 'text', 'author', 'engagement', 'created_at', 'parsed_at', 'parser_version', 'completeness_score'],
          author: ['author_id', 'username', 'avatar_url', 'followers_count', 'following_count'],
          engagement: ['likes', 'reposts', 'replies'],
        },
        warning: 'This contract is LOCKED. Changes require versioning and team approval.',
      },
    });
  });

  /**
   * GET /api/v4/twitter/data-quality
   * Returns data quality metrics for Twitter pipeline
   */
  app.get('/data-quality', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const { getStorageService } = await import('./execution/storage/storage.service.js');
      const storage = getStorageService(db);
      
      const stats = await storage.getTaskStats();
      const recentTweets = await storage.getRecentTweets(100);
      
      // Calculate completeness metrics
      let totalCompleteness = 0;
      let withEngagement = 0;
      let withAuthor = 0;
      
      for (const tweet of recentTweets) {
        if (tweet.completeness_score) totalCompleteness += tweet.completeness_score;
        if (tweet.engagement?.likes !== undefined) withEngagement++;
        if (tweet.author?.username) withAuthor++;
      }
      
      const avgCompleteness = recentTweets.length > 0 
        ? totalCompleteness / recentTweets.length 
        : 0;
      
      return reply.send({
        ok: true,
        data: {
          pipeline: 'twitter-only',
          variant: 'A',
          tasks: stats,
          quality: {
            totalTweets: recentTweets.length,
            avgCompleteness: Math.round(avgCompleteness * 100) / 100,
            withEngagement,
            withAuthor,
            completenessRate: recentTweets.length > 0 
              ? Math.round((withEngagement / recentTweets.length) * 100) 
              : 0,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/v4/twitter/features
   * Returns feature flags for Twitter-only deployment
   */
  app.get('/features', async (req: FastifyRequest, reply: FastifyReply) => {
    const sentimentEnabled = process.env.SENTIMENT_ENABLED === 'true';
    const priceEnabled = process.env.PRICE_LAYER_ENABLED === 'true' || process.env.TWITTER_PRICE_ENABLED === 'true';
    const authorIntelEnabled = process.env.AUTHOR_INTEL_ENABLED === 'true';
    const mlEnabled = process.env.ML_SERVICE_ENABLED === 'true' || process.env.SENTIMENT_ML_RUNTIME === 'true';
    
    return reply.send({
      ok: true,
      data: {
        variant: 'A',
        mode: 'twitter-only',
        features: {
          twitter: true,
          sentiment: sentimentEnabled,
          price: priceEnabled,
          authorIntel: authorIntelEnabled,
          ml: mlEnabled,
        },
        description: 'Variant A: Twitter pipeline only. Sentiment, Price, ML disabled.',
      },
    });
  });

  // Health & Status
  app.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await service.health();
      return reply.send({
        ok: true,
        data: health,
      });
    } catch (error: any) {
      return reply.status(503).send({
        ok: false,
        error: error.message || 'Parser unavailable',
      });
    }
  });

  app.get('/status', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const state = await service.getState();
      const stats = service.getCacheStats();
      const execStatus = service.getExecutionStatus();
      
      return reply.send({
        ok: true,
        data: {
          parser: state.data,
          cache: stats,
          execution: execStatus,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  // Search
  app.get('/search', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query } = req.query as { query?: string };
      
      if (!query) {
        return reply.status(400).send({
          ok: false,
          error: 'query parameter is required',
        });
      }

      const result = await service.search(query);
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'PARSER_PAUSED') {
        return reply.status(503).send({
          ok: false,
          error: 'Parser is currently paused',
          status: 'PAUSED',
        });
      }
      
      return reply.status(500).send({
        ok: false,
        error: error.message || 'Search failed',
      });
    }
  });

  // Account
  app.get('/account/:username', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username } = req.params as { username: string };
      const result = await service.account(username);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message || 'Failed to fetch account',
      });
    }
  });

  // Account Tweets
  app.get('/account/:username/tweets', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username } = req.params as { username: string };
      const result = await service.tweets(username);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message || 'Failed to fetch tweets',
      });
    }
  });

  // Account Followers
  app.get('/account/:username/followers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username } = req.params as { username: string };
      const mode = req.headers['x-parser-mode'] as string | undefined;
      
      const result = await service.followers(username, mode);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'FOLLOWERS_NOT_AVAILABLE_IN_LIMITED_MODE') {
        return reply.status(403).send({
          ok: false,
          error: 'Followers endpoint not available in LIMITED mode',
          mode: 'LIMITED',
        });
      }
      
      return reply.status(500).send({
        ok: false,
        error: error.message || 'Failed to fetch followers',
      });
    }
  });

  // Admin endpoints (passthrough)
  app.post('/admin/mode', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { mode } = req.body as { mode: string };
      const result = await service.setMode(mode);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/admin/pause', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await service.pause();
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/admin/resume', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await service.resume();
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/admin/boost', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { minutes } = req.body as { minutes?: number };
      const result = await service.boost(minutes || 10);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  app.get('/admin/state', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await service.getState();
      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  // B2 Execution endpoints
  app.get('/execution/status', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = service.getExecutionStatus();
      return reply.send({
        ok: true,
        data: status,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/execution/worker/start', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      service.startExecutionWorker();
      return reply.send({
        ok: true,
        message: 'Worker started',
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/execution/worker/stop', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      service.stopExecutionWorker();
      return reply.send({
        ok: true,
        message: 'Worker stopped',
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/execution/reset-counters', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      service.resetExecutionCounters();
      return reply.send({
        ok: true,
        message: 'Counters reset',
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  // Clear runtime registry (force recreation of runtimes)
  app.post('/execution/reset-runtimes', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const oldCount = runtimeRegistry.size;
      runtimeRegistry.clear();
      
      // Force resync from DB
      await twitterExecutionAdapter.syncFromDatabase();
      
      return reply.send({
        ok: true,
        message: `Runtime registry cleared (${oldCount} runtimes removed). Slots resynced from DB.`,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  // B3 Runtime Layer endpoints
  
  /**
   * Execute search using Runtime Layer (Mock/Remote/Proxy)
   * This bypasses old parser service and uses the new abstraction
   */
  app.post('/runtime/search', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { keyword, limit } = req.body as { keyword: string; limit?: number };
      
      if (!keyword) {
        return reply.status(400).send({
          ok: false,
          error: 'keyword is required',
        });
      }

      const result = await twitterExecutionAdapter.executeWithRuntime('SEARCH', {
        keyword,
        q: keyword,
        limit: limit || 20,
      });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Execute account tweets using Runtime Layer
   */
  app.post('/runtime/account/tweets', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, limit } = req.body as { username: string; limit?: number };
      
      if (!username) {
        return reply.status(400).send({
          ok: false,
          error: 'username is required',
        });
      }

      const result = await twitterExecutionAdapter.executeWithRuntime('ACCOUNT_TWEETS', {
        username,
        limit: limit || 20,
      });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Execute following list parsing using Runtime Layer
   * POST /api/v4/twitter/runtime/account/following
   * Returns list of accounts that the user follows
   */
  app.post('/runtime/account/following', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, limit } = req.body as { username: string; limit?: number };
      
      if (!username) {
        return reply.status(400).send({
          ok: false,
          error: 'username is required',
        });
      }

      const result = await twitterExecutionAdapter.executeWithRuntime('FOLLOWING', {
        username,
        limit: limit || 50,
      });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Batch parse following for multiple accounts
   * POST /api/v4/twitter/runtime/batch/following
   * Body: { usernames: string[], limit?: number }
   */
  app.post('/runtime/batch/following', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { usernames, limit } = req.body as { usernames: string[]; limit?: number };
      
      if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
        return reply.status(400).send({
          ok: false,
          error: 'usernames array is required',
        });
      }

      if (usernames.length > 10) {
        return reply.status(400).send({
          ok: false,
          error: 'Maximum 10 usernames per batch',
        });
      }

      const results: { username: string; success: boolean; data?: any; error?: string }[] = [];
      
      for (const username of usernames) {
        try {
          const result = await twitterExecutionAdapter.executeWithRuntime('FOLLOWING', {
            username,
            limit: limit || 50,
          });
          
          results.push({
            username,
            success: result.ok,
            data: result.data,
            error: result.error,
          });
        } catch (err: any) {
          results.push({
            username,
            success: false,
            error: err.message,
          });
        }
      }

      return reply.send({
        ok: true,
        data: {
          total: usernames.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Execute followers list parsing using Runtime Layer
   * POST /api/v4/twitter/runtime/account/followers
   * Returns list of accounts that follow the user (reverse direction)
   */
  app.post('/runtime/account/followers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, limit } = req.body as { username: string; limit?: number };
      
      if (!username) {
        return reply.status(400).send({
          ok: false,
          error: 'username is required',
        });
      }

      const result = await twitterExecutionAdapter.executeWithRuntime('FOLLOWERS', {
        username,
        limit: limit || 50,
      });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Batch parse followers for multiple accounts
   * POST /api/v4/twitter/runtime/batch/followers
   * Body: { usernames: string[], limit?: number }
   */
  app.post('/runtime/batch/followers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { usernames, limit } = req.body as { usernames: string[]; limit?: number };
      
      if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
        return reply.status(400).send({
          ok: false,
          error: 'usernames array is required',
        });
      }

      if (usernames.length > 10) {
        return reply.status(400).send({
          ok: false,
          error: 'Maximum 10 usernames per batch',
        });
      }

      const results: { username: string; success: boolean; data?: any; error?: string }[] = [];
      
      for (const username of usernames) {
        try {
          const result = await twitterExecutionAdapter.executeWithRuntime('FOLLOWERS', {
            username,
            limit: limit || 50,
          });
          
          results.push({
            username,
            success: result.ok,
            data: result.data,
            error: result.error,
          });
        } catch (err: any) {
          results.push({
            username,
            success: false,
            error: err.message,
          });
        }
      }

      return reply.send({
        ok: true,
        data: {
          total: usernames.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Get detailed execution status including runtime info
   */
  app.get('/execution/detailed-status', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await twitterExecutionAdapter.getDetailedStatus();
      return reply.send({
        ok: true,
        data: status,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Check runtime health for a specific slot
   */
  app.post('/runtime/health-check/:slotId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slotId } = req.params as { slotId: string };
      const status = await twitterExecutionAdapter.checkRuntimeHealth(slotId);
      
      return reply.send({
        ok: true,
        data: {
          slotId,
          status,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  // ==================== P2 - Filtered Tweet Query ====================

  /**
   * Query cached tweets with filters (P2)
   * POST /api/v4/twitter/tweets/query
   * 
   * Filters:
   * - minLikes, minReposts, minReplies, minViews (engagement)
   * - timeRange: { from, to } (unix ms)
   * - keyword, author, hashtags (content)
   * - source, query, username (source filters)
   * - limit, offset (pagination)
   */
  app.post('/tweets/query', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const { getStorageService } = await import('./execution/storage/storage.service.js');
      const storage = getStorageService(db);
      
      const filters = req.body as any;
      const result = await storage.queryTweets(filters);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Get recent tweets from cache
   * GET /api/v4/twitter/tweets/recent
   */
  app.get('/tweets/recent', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const { getStorageService } = await import('./execution/storage/storage.service.js');
      const storage = getStorageService(db);
      
      const { limit } = req.query as { limit?: string };
      const tweets = await storage.getRecentTweets(Number(limit) || 50);
      
      return reply.send({
        ok: true,
        data: tweets,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Get tweets by keyword (from cache)
   * GET /api/v4/twitter/tweets/by-keyword/:keyword
   */
  app.get('/tweets/by-keyword/:keyword', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const { getStorageService } = await import('./execution/storage/storage.service.js');
      const storage = getStorageService(db);
      
      const { keyword } = req.params as { keyword: string };
      const { limit } = req.query as { limit?: string };
      const tweets = await storage.getTweetsByQuery(keyword, Number(limit) || 50);
      
      return reply.send({
        ok: true,
        data: tweets,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Get tweets by username (from cache)
   * GET /api/v4/twitter/tweets/by-user/:username
   */
  app.get('/tweets/by-user/:username', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const { getStorageService } = await import('./execution/storage/storage.service.js');
      const storage = getStorageService(db);
      
      const { username } = req.params as { username: string };
      const { limit } = req.query as { limit?: string };
      const tweets = await storage.getTweetsByUsername(username, Number(limit) || 50);
      
      return reply.send({
        ok: true,
        data: tweets,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  // ==================== Task Queue Endpoints ====================

  /**
   * Get task queue stats
   * GET /api/v4/twitter/tasks/stats
   */
  app.get('/tasks/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const { getStorageService } = await import('./execution/storage/storage.service.js');
      const storage = getStorageService(db);
      
      const stats = await storage.getTaskStats();
      
      return reply.send({
        ok: true,
        data: stats,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  /**
   * Get tasks by status
   * GET /api/v4/twitter/tasks/:status
   */
  app.get('/tasks/:status', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const { getStorageService } = await import('./execution/storage/storage.service.js');
      const storage = getStorageService(db);
      
      const { status } = req.params as { status: string };
      const { limit } = req.query as { limit?: string };
      
      const validStatuses = ['QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return reply.status(400).send({
          ok: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }
      
      const tasks = await storage.getTasksByStatus(
        status.toUpperCase() as any,
        Number(limit) || 50
      );
      
      return reply.send({
        ok: true,
        data: tasks,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error.message,
      });
    }
  });
}
