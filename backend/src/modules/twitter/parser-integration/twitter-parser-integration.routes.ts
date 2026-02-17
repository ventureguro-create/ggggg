/**
 * Twitter Parser Integration Routes
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { TwitterParserIntegrationService } from './twitter-parser-integration.service.js';

// Singleton for the service
let integrationService: TwitterParserIntegrationService | null = null;

export async function registerTwitterParserIntegrationRoutes(
  app: FastifyInstance,
  db: Db
): Promise<void> {
  integrationService = new TwitterParserIntegrationService(db);

  // GET /api/admin/twitter-parser/integration/status - get integration status
  app.get('/api/admin/twitter-parser/integration/status', async (req, reply) => {
    const status = await integrationService!.getStatus();
    return reply.send({ ok: true, data: status });
  });

  // POST /api/admin/twitter-parser/integration/search - search and process
  app.post('/api/admin/twitter-parser/integration/search', async (req, reply) => {
    const { keyword, limit = 20, sessionId } = req.body as any;
    if (!keyword) {
      return reply.status(400).send({ ok: false, error: 'Missing keyword' });
    }

    try {
      const result = await integrationService!.searchAndProcess(keyword, limit, sessionId);
      return reply.send({ ok: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });

  // POST /api/admin/twitter-parser/integration/user - get user tweets and process
  app.post('/api/admin/twitter-parser/integration/user', async (req, reply) => {
    const { username, limit = 20, sessionId } = req.body as any;
    if (!username) {
      return reply.status(400).send({ ok: false, error: 'Missing username' });
    }

    try {
      const result = await integrationService!.getUserTweetsAndProcess(username, limit, sessionId);
      return reply.send({ ok: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });

  // POST /api/admin/twitter-parser/integration/webhook - process webhook from parser
  app.post('/api/admin/twitter-parser/integration/webhook', async (req, reply) => {
    const { tweets, source } = req.body as any;
    if (!tweets || !Array.isArray(tweets)) {
      return reply.status(400).send({ ok: false, error: 'Missing tweets array' });
    }

    try {
      await integrationService!.processWebhook({ tweets, source: source || 'webhook' });
      return reply.send({ ok: true, message: `Processed ${tweets.length} tweets` });
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });

  // POST /api/admin/twitter-parser/integration/polling/start - start polling
  app.post('/api/admin/twitter-parser/integration/polling/start', async (req, reply) => {
    const { intervalMs = 60000 } = req.body as any;
    integrationService!.startPolling(intervalMs);
    return reply.send({ ok: true, message: 'Polling started' });
  });

  // POST /api/admin/twitter-parser/integration/polling/stop - stop polling
  app.post('/api/admin/twitter-parser/integration/polling/stop', async (req, reply) => {
    integrationService!.stopPolling();
    return reply.send({ ok: true, message: 'Polling stopped' });
  });

  // POST /api/admin/twitter-parser/integration/batch - batch search multiple keywords
  app.post('/api/admin/twitter-parser/integration/batch', async (req, reply) => {
    const { keywords, limit = 10, sessionId } = req.body as any;
    if (!keywords || !Array.isArray(keywords)) {
      return reply.status(400).send({ ok: false, error: 'Missing keywords array' });
    }

    const results: any[] = [];
    for (const keyword of keywords) {
      try {
        const result = await integrationService!.searchAndProcess(keyword, limit, sessionId);
        results.push({ keyword, ...result, ok: true });
      } catch (err: any) {
        results.push({ keyword, ok: false, error: err.message });
      }
      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }

    return reply.send({ ok: true, data: results });
  });

  console.log('[BOOT] Twitter Parser Integration routes registered');
}
