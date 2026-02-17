// Twitter Parser V2 - MULTI Architecture Server + Mongo Task Queue
// Receives cookies + proxy from backend, executes and returns data

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config.js';
import { browserManager } from './browser/browser-manager.js';
import { twitterClient } from './browser/twitter-client.js';
import { 
  MongoTaskQueue, 
  MongoTaskWorker, 
  MockTwitterRuntime 
} from './queue/index.js';

// Initialize Queue and Worker
let taskQueue: MongoTaskQueue;
let taskWorker: MongoTaskWorker;

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'running',
    version: '2.0-MULTI',
  });
});

/**
 * Search tweets by keyword
 * MULTI Architecture: receives cookies and proxy via body
 * 
 * POST /search/:keyword
 * Body: { limit, cookies, proxyUrl, userAgent }
 */
app.post('/search/:keyword', async (req, res) => {
  const { keyword } = req.params;
  const { limit = 20, cookies, proxyUrl, userAgent } = req.body;

  if (!cookies || !Array.isArray(cookies)) {
    return res.status(400).json({ ok: false, error: 'Missing cookies' });
  }

  console.log(`[API] Search: "${keyword}" | Cookies: ${cookies.length} | Proxy: ${proxyUrl ? 'yes' : 'no'}`);

  try {
    const result = await twitterClient.searchWithCredentials({
      keyword,
      limit,
      cookies,
      proxyUrl,
      userAgent: userAgent || config.userAgent,
    });

    res.json({
      ok: true,
      data: result,
    });
  } catch (error: any) {
    console.error(`[API] Search error:`, error.message);

    // Map errors to status codes
    if (error.message.includes('blocked') || error.message.includes('Could not log')) {
      return res.status(403).json({ ok: false, error: error.message });
    }
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ ok: false, error: error.message });
    }

    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * Get user tweets
 * POST /tweets/:username
 */
app.post('/tweets/:username', async (req, res) => {
  const { username } = req.params;
  const { limit = 20, cookies, proxyUrl, userAgent } = req.body;

  if (!cookies || !Array.isArray(cookies)) {
    return res.status(400).json({ ok: false, error: 'Missing cookies' });
  }

  console.log(`[API] User tweets: @${username} | Cookies: ${cookies.length}`);

  try {
    const tweets = await twitterClient.getUserTweetsWithCredentials({
      username,
      limit,
      cookies,
      proxyUrl,
      userAgent: userAgent || config.userAgent,
    });

    res.json({
      ok: true,
      data: { tweets },
    });
  } catch (error: any) {
    console.error(`[API] User tweets error:`, error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * Get user profile
 * POST /profile/:username
 */
app.post('/profile/:username', async (req, res) => {
  const { username } = req.params;
  const { cookies, proxyUrl, userAgent } = req.body;

  if (!cookies || !Array.isArray(cookies)) {
    return res.status(400).json({ ok: false, error: 'Missing cookies' });
  }

  console.log(`[API] Profile: @${username}`);

  try {
    const profile = await twitterClient.getUserProfileWithCredentials({
      username,
      cookies,
      proxyUrl,
      userAgent: userAgent || config.userAgent,
    });

    if (!profile) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({
      ok: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * P1: Warmth Ping - Check if session is alive
 * Makes a lightweight request to Twitter's Viewer API
 * POST /warmth/ping
 * Body: { cookies, proxyUrl, userAgent, action }
 */
app.post('/warmth/ping', async (req, res) => {
  const { cookies, proxyUrl, userAgent, action = 'PING_VIEWER' } = req.body;

  if (!cookies || !Array.isArray(cookies)) {
    return res.status(400).json({ ok: false, error: 'Missing cookies' });
  }

  console.log(`[API] Warmth ping | Cookies: ${cookies.length} | Action: ${action}`);
  const startTime = Date.now();

  try {
    // Create a lightweight browser context just to check session validity
    const result = await twitterClient.pingSession({
      cookies,
      proxyUrl,
      userAgent: userAgent || config.userAgent,
    });

    const latencyMs = Date.now() - startTime;

    res.json({
      ok: true,
      success: result.success,
      httpStatus: result.httpStatus,
      latencyMs,
      userId: result.userId,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error(`[API] Warmth ping error:`, error.message);

    // Determine if this is auth failure vs network failure
    const isAuthError = error.message.includes('401') || 
                        error.message.includes('403') || 
                        error.message.includes('blocked');

    res.json({
      ok: true, // Request completed, but session may be invalid
      success: false,
      httpStatus: isAuthError ? 401 : 500,
      latencyMs,
      error: error.message,
    });
  }
});

// Legacy endpoints (backward compat with session-based approach)
// These use internal session manager - kept for testing
app.get('/sessions', (req, res) => {
  res.json({ ok: true, data: [], note: 'MULTI mode - sessions managed by backend' });
});

// ========================================
// MONGO TASK QUEUE API ENDPOINTS
// ========================================

/**
 * Enqueue a search task
 * POST /api/v4/twitter/tasks/search
 */
app.post('/api/v4/twitter/tasks/search', async (req, res) => {
  try {
    const { query, filters } = req.body;

    if (!query) {
      return res.status(400).json({ ok: false, error: 'Missing query' });
    }

    const task = await taskQueue.enqueue('SEARCH', { query, filters });

    res.json({
      ok: true,
      data: {
        taskId: task._id,
        type: task.type,
        status: task.status,
        createdAt: task.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Enqueue an account tweets task
 * POST /api/v4/twitter/tasks/account
 */
app.post('/api/v4/twitter/tasks/account', async (req, res) => {
  try {
    const { username, limit } = req.body;

    if (!username) {
      return res.status(400).json({ ok: false, error: 'Missing username' });
    }

    const task = await taskQueue.enqueue('ACCOUNT_TWEETS', { username, limit });

    res.json({
      ok: true,
      data: {
        taskId: task._id,
        type: task.type,
        status: task.status,
        createdAt: task.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Get queue statistics
 * GET /api/v4/twitter/queue/stats
 */
app.get('/api/v4/twitter/queue/stats', async (req, res) => {
  try {
    const stats = await taskQueue.getStats();
    res.json({ ok: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Get worker status
 * GET /api/v4/twitter/worker/status
 */
app.get('/api/v4/twitter/worker/status', (req, res) => {
  try {
    const status = taskWorker.getStatus();
    res.json({ ok: true, data: status });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Recover stale tasks
 * POST /api/v4/twitter/queue/recover
 */
app.post('/api/v4/twitter/queue/recover', async (req, res) => {
  try {
    const recovered = await taskQueue.recoverStale();
    res.json({ ok: true, data: { recovered } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ========================================
// END MONGO TASK QUEUE API
// ========================================

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  taskWorker?.stop();
  await browserManager.close();
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  taskWorker?.stop();
  await browserManager.close();
  await mongoose.disconnect();
  process.exit(0);
});

// Start server
async function start() {
  try {
    // 1. Connect to MongoDB
    const mongoUrl = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/crypto_analytics';
    console.log('[Server] Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, {
      autoIndex: false, // Prevent duplicate index warnings
    });
    console.log('[Server] MongoDB connected');

    // 2. Initialize Task Queue
    console.log('[Server] Initializing task queue...');
    taskQueue = new MongoTaskQueue();
    
    // 3. Initialize Mock Runtime (replace with real TwitterRuntime later)
    const runtime = new MockTwitterRuntime();

    // 4. Initialize and start Worker
    console.log('[Server] Starting task worker...');
    taskWorker = new MongoTaskWorker(taskQueue, runtime);
    taskWorker.start();

    // 5. Initialize browser
    console.log('[Server] Initializing browser...');
    await browserManager.initialize();

    // 6. Start Express server
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 Twitter Parser V2 (MULTI + Queue) running on port ${config.port}`);
      console.log(`   MongoDB: ${mongoUrl}`);
      console.log(`   Task Worker: ACTIVE`);
      console.log(`   Browser: READY`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

start();
