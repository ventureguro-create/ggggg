/**
 * Telegram Discovery Routes
 * 
 * API endpoints: /api/telegram/*
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { discoveryService, metricsService, rankingService, fraudService } from '../services/index.js';
import { TgChannelModel, TgPostModel, TgCandidateModel } from '../models/index.js';
import { telegramAdapter } from '../adapter/index.js';

export async function registerTelegramDiscoveryRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Health & Status ====================
  
  /**
   * GET /api/telegram/health
   * Health check for Telegram Discovery module
   */
  app.get('/api/telegram/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    const adapterStatus = telegramAdapter.getStatus();
    const stats = await discoveryService.getStats();
    
    return reply.send({
      ok: true,
      module: 'telegram-discovery',
      version: '1.0.0',
      adapter: adapterStatus,
      stats,
    });
  });

  // ==================== Channels ====================

  /**
   * GET /api/telegram/channels
   * List all channels with pagination
   */
  app.get('/api/telegram/channels', async (req: FastifyRequest<{
    Querystring: { 
      status?: string; 
      limit?: string; 
      offset?: string;
      sort?: string;
    }
  }>, reply: FastifyReply) => {
    const status = req.query.status || 'active';
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const offset = parseInt(req.query.offset || '0');
    const sort = req.query.sort || '-rankingScore';

    const filter = status === 'all' ? {} : { status };
    
    const [channels, total] = await Promise.all([
      TgChannelModel.find(filter)
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .lean(),
      TgChannelModel.countDocuments(filter),
    ]);

    return reply.send({
      ok: true,
      data: channels.map(ch => ({
        channelId: ch.channelId,
        username: ch.username,
        title: ch.title,
        status: ch.status,
        subscriberCount: ch.subscriberCount,
        rankingScore: ch.rankingScore,
        qualityScore: ch.qualityScore,
        fraudScore: ch.fraudScore,
        tags: ch.tags,
        category: ch.category,
        lastChecked: ch.lastChecked,
      })),
      pagination: { total, limit, offset },
    });
  });

  /**
   * GET /api/telegram/channels/:channelId
   * Get single channel details
   */
  app.get('/api/telegram/channels/:channelId', async (req: FastifyRequest<{
    Params: { channelId: string }
  }>, reply: FastifyReply) => {
    const channel = await TgChannelModel.findOne({ 
      channelId: req.params.channelId 
    }).lean();

    if (!channel) {
      return reply.status(404).send({ ok: false, error: 'Channel not found' });
    }

    // Get metrics
    const metrics = await metricsService.getMetricsHistory(channel.channelId, 7);
    
    // Get ranking history
    const rankings = await rankingService.getChannelRankingHistory(channel.channelId, 30);

    return reply.send({
      ok: true,
      data: {
        ...channel,
        _id: undefined,
        metrics,
        rankings,
      },
    });
  });

  /**
   * POST /api/telegram/channels/seed
   * Add seed channel manually
   */
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

  /**
   * PATCH /api/telegram/channels/:channelId/status
   * Update channel status
   */
  app.patch('/api/telegram/channels/:channelId/status', async (req: FastifyRequest<{
    Params: { channelId: string };
    Body: { status: 'active' | 'paused' | 'rejected' }
  }>, reply: FastifyReply) => {
    const result = await TgChannelModel.updateOne(
      { channelId: req.params.channelId },
      { status: req.body.status }
    );

    if (result.matchedCount === 0) {
      return reply.status(404).send({ ok: false, error: 'Channel not found' });
    }

    return reply.send({ ok: true });
  });

  // ==================== Discovery ====================

  /**
   * GET /api/telegram/discovery/stats
   * Get discovery statistics
   */
  app.get('/api/telegram/discovery/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    const stats = await discoveryService.getStats();
    return reply.send({ ok: true, data: stats });
  });

  /**
   * GET /api/telegram/discovery/candidates
   * Get pending candidates
   */
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

  /**
   * POST /api/telegram/discovery/process
   * Process pending candidates (approve/reject)
   */
  app.post('/api/telegram/discovery/process', async (req: FastifyRequest<{
    Body: { 
      username: string; 
      action: 'approve' | 'reject';
      title?: string;
      tags?: string[];
    }
  }>, reply: FastifyReply) => {
    const { username, action, title, tags } = req.body;

    const candidate = await TgCandidateModel.findOne({ username });
    if (!candidate) {
      return reply.status(404).send({ ok: false, error: 'Candidate not found' });
    }

    if (action === 'approve') {
      // Create channel from candidate
      const result = await discoveryService.seedChannel({
        username,
        title: title || username,
        tags: tags || [],
      });

      if (!result.ok) {
        return reply.status(400).send({ ok: false, error: result.error });
      }

      await TgCandidateModel.updateOne(
        { username },
        { status: 'approved', processedAt: new Date() }
      );

      return reply.send({ ok: true, channelId: result.channelId });
    } else {
      await TgCandidateModel.updateOne(
        { username },
        { status: 'rejected', processedAt: new Date() }
      );
      return reply.send({ ok: true });
    }
  });

  // ==================== Rankings ====================

  /**
   * GET /api/telegram/rankings
   * Get latest rankings
   */
  app.get('/api/telegram/rankings', async (req: FastifyRequest<{
    Querystring: { limit?: string }
  }>, reply: FastifyReply) => {
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const rankings = await rankingService.getLatestRankings(limit);
    
    return reply.send({ ok: true, data: rankings });
  });

  /**
   * POST /api/telegram/rankings/calculate
   * Trigger ranking calculation (admin)
   */
  app.post('/api/telegram/rankings/calculate', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await rankingService.calculateDailyRankings();
    
    if (!result.ok) {
      return reply.status(500).send({ ok: false, error: result.error });
    }

    return reply.send({ ok: true, ranked: result.ranked });
  });

  // ==================== Fraud Detection ====================

  /**
   * GET /api/telegram/fraud/analyze/:channelId
   * Analyze channel for fraud
   */
  app.get('/api/telegram/fraud/analyze/:channelId', async (req: FastifyRequest<{
    Params: { channelId: string }
  }>, reply: FastifyReply) => {
    const result = await fraudService.analyzeChannel(req.params.channelId);
    return reply.send({ ok: true, data: result });
  });

  /**
   * POST /api/telegram/fraud/update-scores
   * Update fraud scores for all channels (admin)
   */
  app.post('/api/telegram/fraud/update-scores', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await fraudService.updateFraudScores();
    return reply.send({ ok: true, updated: result.updated });
  });

  // ==================== Metrics ====================

  /**
   * GET /api/telegram/metrics/:channelId
   * Get channel metrics history
   */
  app.get('/api/telegram/metrics/:channelId', async (req: FastifyRequest<{
    Params: { channelId: string };
    Querystring: { days?: string }
  }>, reply: FastifyReply) => {
    const days = parseInt(req.query.days || '7');
    const metrics = await metricsService.getMetricsHistory(req.params.channelId, days);
    
    return reply.send({ ok: true, data: metrics });
  });

  /**
   * POST /api/telegram/metrics/calculate/:channelId
   * Trigger metrics calculation for channel
   */
  app.post('/api/telegram/metrics/calculate/:channelId', async (req: FastifyRequest<{
    Params: { channelId: string }
  }>, reply: FastifyReply) => {
    const result = await metricsService.calculateHourlyMetrics({
      channelId: req.params.channelId,
    });

    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }

    return reply.send({ ok: true, metrics: result.metrics });
  });

  console.log('[TelegramDiscovery] Routes registered: /api/telegram/*');
}
