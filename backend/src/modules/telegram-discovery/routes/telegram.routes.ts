/**
 * Telegram Discovery Routes (EXTENDED)
 * 
 * API endpoints: /api/telegram/*
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { discoveryService, metricsService, rankingService, fraudService } from '../services/index.js';
import { TgChannelModel, TgPostModel, TgCandidateModel, TgCategoryMembershipModel } from '../models/index.js';
import { TgMetricsModel } from '../models/tg_metrics.model.js';
import { TgRankingModel } from '../models/tg_rankings.model.js';
import { telegramAdapter } from '../adapter/index.js';

export async function registerTelegramDiscoveryRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Health & Status ====================
  
  app.get('/api/telegram/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    const adapterStatus = telegramAdapter.getStatus();
    const stats = await discoveryService.getStats();
    
    return reply.send({
      ok: true,
      module: 'telegram-discovery',
      version: '2.0.0',
      adapter: adapterStatus,
      stats,
    });
  });

  // ==================== Channels ====================

  app.get('/api/telegram/channels', async (req: FastifyRequest<{
    Querystring: { 
      status?: string; 
      limit?: string; 
      offset?: string;
      sort?: string;
      category?: string;
      trust?: string;
      minScore?: string;
      lang?: string;
    }
  }>, reply: FastifyReply) => {
    const status = req.query.status || 'active';
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const offset = parseInt(req.query.offset || '0');
    const category = req.query.category?.toUpperCase();
    const minScore = req.query.minScore ? Number(req.query.minScore) : null;
    const lang = req.query.lang?.toUpperCase();

    // If filtering by category, get usernames first
    let usernames: string[] | null = null;
    if (category) {
      const memberships = await TgCategoryMembershipModel
        .find({ category, confidence: { $gte: 0.45 } })
        .select('username')
        .limit(5000)
        .lean();
      usernames = memberships.map(m => m.username);
    }

    // Build filter
    const filter: any = {};
    if (status !== 'all') filter.status = status;
    if (usernames) filter.username = { $in: usernames };
    
    // Get from rankings for score filtering
    if (minScore !== null) {
      const rankings = await TgRankingModel
        .find({ overallScore: { $gte: minScore } })
        .sort({ overallScore: -1 })
        .select('username')
        .limit(5000)
        .lean();
      
      const rankUsernames = rankings.map(r => r.username);
      if (usernames) {
        filter.username = { $in: usernames.filter(u => rankUsernames.includes(u)) };
      } else {
        filter.username = { $in: rankUsernames };
      }
    }

    // Language filter via metrics
    if (lang) {
      const metricsWithLang = await TgMetricsModel
        .find({ language: lang })
        .select('username')
        .limit(5000)
        .lean();
      
      const langUsernames = metricsWithLang.map(m => m.username);
      if (filter.username) {
        const existing = Array.isArray(filter.username.$in) ? filter.username.$in : [];
        filter.username = { $in: existing.filter((u: string) => langUsernames.includes(u)) };
      } else {
        filter.username = { $in: langUsernames };
      }
    }

    const [channels, total] = await Promise.all([
      TgChannelModel.find(filter)
        .sort({ rankingScore: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      TgChannelModel.countDocuments(filter),
    ]);

    // Enrich with ranking data
    const usernamesToEnrich = channels.map(c => c.username);
    const rankings = await TgRankingModel
      .find({ username: { $in: usernamesToEnrich } })
      .sort({ date: -1 })
      .lean();
    
    const rankMap = new Map(rankings.map(r => [r.username, r]));

    return reply.send({
      ok: true,
      data: channels.map(ch => {
        const rank = rankMap.get(ch.username);
        return {
          channelId: ch.channelId,
          username: ch.username,
          title: ch.title,
          status: ch.status,
          subscriberCount: ch.subscriberCount,
          rankingScore: ch.rankingScore || rank?.overallScore || 0,
          trustLevel: rank?.trustLevel || 'B',
          fraudRisk: rank?.fraudRisk || 0,
          tags: ch.tags,
          category: ch.category,
          lastChecked: ch.lastChecked,
        };
      }),
      pagination: { total, limit, offset },
    });
  });

  app.get('/api/telegram/channels/:username', async (req: FastifyRequest<{
    Params: { username: string }
  }>, reply: FastifyReply) => {
    const username = req.params.username.toLowerCase().replace('@', '');
    
    const channel = await TgChannelModel.findOne({ username }).lean();
    if (!channel) {
      return reply.status(404).send({ ok: false, error: 'Channel not found' });
    }

    // Get metrics
    const metrics = await TgMetricsModel.findOne({ username }).sort({ timestamp: -1 }).lean();
    
    // Get ranking
    const ranking = await TgRankingModel.findOne({ username }).sort({ date: -1 }).lean();

    // Get categories
    const categories = await TgCategoryMembershipModel.find({ username }).lean();

    return reply.send({
      ok: true,
      data: {
        ...channel,
        _id: undefined,
        metrics,
        ranking,
        categories: categories.map(c => ({ category: c.category, confidence: c.confidence })),
      },
    });
  });

  app.post('/api/telegram/channels/seed', async (req: FastifyRequest<{
    Body: {
      username: string;
      title: string;
      description?: string;
      tags?: string[];
      category?: string;
    }
  }>, reply: FastifyReply) => {
    const result = await discoveryService.seedChannel(req.body);
    
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }

    return reply.send({ ok: true, channelId: result.channelId });
  });

  app.patch('/api/telegram/channels/:username/status', async (req: FastifyRequest<{
    Params: { username: string };
    Body: { status: 'active' | 'paused' | 'rejected' }
  }>, reply: FastifyReply) => {
    const username = req.params.username.toLowerCase().replace('@', '');
    
    const result = await TgChannelModel.updateOne(
      { username },
      { status: req.body.status }
    );

    if (result.matchedCount === 0) {
      return reply.status(404).send({ ok: false, error: 'Channel not found' });
    }

    return reply.send({ ok: true });
  });

  // ==================== Discovery ====================

  app.get('/api/telegram/discovery/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    const stats = await discoveryService.getStats();
    return reply.send({ ok: true, data: stats });
  });

  app.get('/api/telegram/discovery/candidates', async (req: FastifyRequest<{
    Querystring: { limit?: string; status?: string }
  }>, reply: FastifyReply) => {
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const status = req.query.status || 'pending';

    const candidates = await TgCandidateModel
      .find({ status })
      .sort({ priority: -1, discoveredAt: 1 })
      .limit(limit)
      .lean();

    return reply.send({
      ok: true,
      data: candidates.map(c => ({
        username: c.username,
        status: c.status,
        priority: c.priority,
        mentionCount: c.mentionCount,
        discoveredFrom: c.discoveredFrom,
        discoveryMethod: c.discoveryMethod,
        discoveredAt: c.discoveredAt,
      })),
    });
  });

  app.post('/api/telegram/discovery/process', async (req: FastifyRequest<{
    Body: { 
      username: string; 
      action: 'approve' | 'reject';
      title?: string;
      tags?: string[];
    }
  }>, reply: FastifyReply) => {
    const { username, action, title, tags } = req.body;

    const candidate = await TgCandidateModel.findOne({ username: username.toLowerCase() });
    if (!candidate) {
      return reply.status(404).send({ ok: false, error: 'Candidate not found' });
    }

    if (action === 'approve') {
      const result = await discoveryService.seedChannel({
        username,
        title: title || username,
        tags: tags || [],
      });

      if (!result.ok) {
        return reply.status(400).send({ ok: false, error: result.error });
      }

      await TgCandidateModel.updateOne(
        { username: username.toLowerCase() },
        { status: 'approved', processedAt: new Date() }
      );

      return reply.send({ ok: true, channelId: result.channelId });
    } else {
      await TgCandidateModel.updateOne(
        { username: username.toLowerCase() },
        { status: 'rejected', processedAt: new Date() }
      );
      return reply.send({ ok: true });
    }
  });

  // ==================== Search ====================

  app.get('/api/telegram/discovery/search', async (req: FastifyRequest<{
    Querystring: {
      limit?: string;
      lang?: string;
      topic?: string;
      minTopic?: string;
      minScore?: string;
      trust?: string;
    }
  }>, reply: FastifyReply) => {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const lang = req.query.lang?.toUpperCase();
    const topic = req.query.topic?.toLowerCase();
    const minTopic = req.query.minTopic ? Number(req.query.minTopic) : 0.6;
    const minScore = req.query.minScore ? Number(req.query.minScore) : null;
    const trust = req.query.trust?.split(',').map(t => t.toUpperCase());

    // Build metrics filter
    const mf: any = {};
    if (lang) mf.language = lang;
    if (topic) mf[`topicVector.${topic}`] = { $gte: minTopic };

    const metrics = await TgMetricsModel.find(mf).select('username').limit(5000).lean();
    let usernames = metrics.map(m => m.username);

    // Filter by ranking
    const rf: any = { username: { $in: usernames } };
    if (minScore !== null) rf.overallScore = { $gte: minScore };
    if (trust) rf.trustLevel = { $in: trust };

    const ranked = await TgRankingModel.find(rf)
      .sort({ overallScore: -1 })
      .limit(limit)
      .lean();

    return reply.send({ ok: true, results: ranked });
  });

  // ==================== Rankings ====================

  app.get('/api/telegram/rankings', async (req: FastifyRequest<{
    Querystring: { limit?: string; trust?: string }
  }>, reply: FastifyReply) => {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const trust = req.query.trust?.split(',').map(t => t.toUpperCase());
    
    const rankings = await rankingService.getLatestRankings(limit);
    
    const filtered = trust 
      ? rankings.filter(r => trust.includes(r.trustLevel))
      : rankings;
    
    return reply.send({ ok: true, data: filtered });
  });

  app.post('/api/telegram/rankings/calculate', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await rankingService.calculateDailyRankings();
    
    if (!result.ok) {
      return reply.status(500).send({ ok: false, error: result.error });
    }

    return reply.send({ ok: true, ranked: result.ranked });
  });

  // ==================== Fraud Detection ====================

  app.get('/api/telegram/fraud/analyze/:username', async (req: FastifyRequest<{
    Params: { username: string }
  }>, reply: FastifyReply) => {
    const username = req.params.username.toLowerCase().replace('@', '');
    const result = await fraudService.analyzeChannel(username);
    return reply.send({ ok: true, data: result });
  });

  app.post('/api/telegram/fraud/update-scores', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await fraudService.updateFraudScores();
    return reply.send({ ok: true, updated: result.updated });
  });

  // ==================== Metrics ====================

  app.get('/api/telegram/metrics/:username', async (req: FastifyRequest<{
    Params: { username: string };
    Querystring: { days?: string }
  }>, reply: FastifyReply) => {
    const username = req.params.username.toLowerCase().replace('@', '');
    const days = parseInt(req.query.days || '7');
    
    const metrics = await metricsService.getMetricsHistory(username, days);
    
    return reply.send({ ok: true, data: metrics });
  });

  app.post('/api/telegram/metrics/calculate/:username', async (req: FastifyRequest<{
    Params: { username: string };
    Querystring: { days?: string }
  }>, reply: FastifyReply) => {
    const username = req.params.username.toLowerCase().replace('@', '');
    const days = parseInt(req.query.days || '30');
    
    const result = await metricsService.calculateMetrics({ username, days });

    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }

    return reply.send({ ok: true, metrics: result.metrics });
  });

  // ==================== Debug ====================

  app.get('/api/telegram/channels/:username/debug', async (req: FastifyRequest<{
    Params: { username: string }
  }>, reply: FastifyReply) => {
    const username = req.params.username.toLowerCase().replace('@', '');

    const [channel, metrics, ranking, categories] = await Promise.all([
      TgChannelModel.findOne({ username }).lean(),
      TgMetricsModel.findOne({ username }).sort({ timestamp: -1 }).lean(),
      TgRankingModel.findOne({ username }).sort({ date: -1 }).lean(),
      TgCategoryMembershipModel.find({ username }).lean(),
    ]);

    if (!channel) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }

    return reply.send({ 
      ok: true, 
      channel: { ...channel, _id: undefined },
      metrics: metrics ? { ...metrics, _id: undefined } : null,
      ranking: ranking ? { ...ranking, _id: undefined } : null,
      categories: categories.map(c => ({ 
        category: c.category, 
        confidence: c.confidence,
        method: c.method,
      })),
    });
  });

  // ==================== Admin ====================

  app.post('/api/telegram/admin/recompute', async (req: FastifyRequest<{
    Querystring: { days?: string }
  }>, reply: FastifyReply) => {
    const days = parseInt(req.query.days || '30');
    
    // Build metrics for all channels
    const metricsResult = await metricsService.buildDailyMetrics(days);
    
    // Calculate rankings
    const rankingResult = await rankingService.calculateDailyRankings();

    return reply.send({ 
      ok: true, 
      metrics: metricsResult,
      ranking: rankingResult,
    });
  });

  console.log('[TelegramDiscovery] Routes registered: /api/telegram/*');
}
