/**
 * Time Series API Routes
 * 
 * Prefix: /api/connections/timeseries
 * 
 * Endpoints:
 * - POST /seed - Generate mock historical data
 * - POST /append - Add single data point
 * - GET /:account_id - Get time series data
 * - GET /:account_id/summary - Get aggregated summary
 * - GET /top/breakouts - Get accounts with most breakouts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TSFollowersModel, TSEngagementModel, TSScoresModel } from './models.js';
import { seedTimeSeries, appendTimeSeriesPoint, batchSeedAccounts, SeedType } from './seed.generator.js';
import { computeTimeSeriesSummary, getTopBreakoutAccounts } from './summary.compute.js';
import { timeseriesAdminConfig } from './admin.config.js';

export async function registerTimeseriesRoutes(app: FastifyInstance): Promise<void> {
  
  // ============================================================
  // WRITE ENDPOINTS
  // ============================================================
  
  /**
   * POST /api/connections/timeseries/seed
   * Generate mock historical data for an account
   */
  app.post('/seed', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!timeseriesAdminConfig.mock_seeding_enabled) {
      return reply.status(403).send({
        ok: false,
        error: 'SEEDING_DISABLED',
        message: 'Mock seeding is disabled in config',
      });
    }
    
    const body = req.body as {
      account_id: string;
      days?: number;
      seed_type?: SeedType;
      base_followers?: number;
      base_score?: number;
    };
    
    if (!body.account_id) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'account_id required',
      });
    }
    
    const days = Math.min(body.days || timeseriesAdminConfig.default_window, 180);
    const seedType = body.seed_type || 'growing';
    
    try {
      const result = await seedTimeSeries({
        account_id: body.account_id,
        days,
        seed_type: seedType,
        base_followers: body.base_followers,
        base_score: body.base_score,
      });
      
      return reply.send({
        ok: true,
        message: `Generated ${days} days of ${seedType} history`,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'SEED_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * POST /api/connections/timeseries/seed/batch
   * Seed multiple accounts at once
   */
  app.post('/seed/batch', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!timeseriesAdminConfig.mock_seeding_enabled) {
      return reply.status(403).send({
        ok: false,
        error: 'SEEDING_DISABLED',
        message: 'Mock seeding is disabled in config',
      });
    }
    
    const body = req.body as {
      count?: number;
      days?: number;
    };
    
    const count = Math.min(body.count || 10, 50);
    const days = Math.min(body.days || 30, 90);
    
    try {
      const result = await batchSeedAccounts(count, days);
      
      return reply.send({
        ok: true,
        message: `Seeded ${count} accounts with ${days} days of history`,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'BATCH_SEED_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * POST /api/connections/timeseries/append
   * Add single data point (for future Twitter integration)
   */
  app.post('/append', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      account_id: string;
      followers?: number;
      engagement?: {
        likes: number;
        reposts: number;
        replies: number;
        quotes?: number;
        views?: number;
        posts_count?: number;
      };
      score_snapshot?: {
        twitter_score: number;
        components?: any;
        network_sub?: any;
        early_signal?: any;
      };
      source?: 'mock' | 'twitter';
    };
    
    if (!body.account_id) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'account_id required',
      });
    }
    
    if (!body.followers && !body.engagement && !body.score_snapshot) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'At least one of followers, engagement, or score_snapshot required',
      });
    }
    
    try {
      await appendTimeSeriesPoint({
        account_id: body.account_id,
        followers: body.followers,
        engagement: body.engagement,
        score_snapshot: body.score_snapshot,
        source: body.source || 'mock',
      });
      
      return reply.send({
        ok: true,
        message: 'Data point appended',
        data: {
          account_id: body.account_id,
          appended: {
            followers: body.followers !== undefined,
            engagement: body.engagement !== undefined,
            score: body.score_snapshot !== undefined,
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'APPEND_ERROR',
        message: error.message,
      });
    }
  });
  
  // ============================================================
  // READ ENDPOINTS
  // ============================================================
  
  /**
   * GET /api/connections/timeseries/:account_id
   * Get time series data for an account
   */
  app.get('/:account_id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { account_id } = req.params as { account_id: string };
    const query = req.query as { window?: string };
    
    const windowDays = parseInt(query.window?.replace('d', '') || String(timeseriesAdminConfig.default_window));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);
    
    try {
      const [followers, engagement, scores] = await Promise.all([
        TSFollowersModel.find({ 
          account_id, 
          ts: { $gte: startDate } 
        })
        .sort({ ts: 1 })
        .select('-_id -__v -created_at')
        .lean(),
        
        TSEngagementModel.find({ 
          account_id, 
          ts: { $gte: startDate } 
        })
        .sort({ ts: 1 })
        .select('-_id -__v -created_at')
        .lean(),
        
        TSScoresModel.find({ 
          account_id, 
          ts: { $gte: startDate } 
        })
        .sort({ ts: 1 })
        .select('-_id -__v -created_at')
        .lean(),
      ]);
      
      if (followers.length === 0 && engagement.length === 0 && scores.length === 0) {
        return reply.status(404).send({
          ok: false,
          error: 'NO_DATA',
          message: `No time series data found for account: ${account_id}`,
        });
      }
      
      return reply.send({
        ok: true,
        data: {
          account_id,
          window: `${windowDays}d`,
          points: {
            followers: followers.length,
            engagement: engagement.length,
            scores: scores.length,
          },
          followers: followers.map(f => ({
            ts: f.ts,
            followers: f.followers,
            delta_1d: f.delta_1d,
          })),
          engagement: engagement.map(e => ({
            ts: e.ts,
            likes: e.likes,
            reposts: e.reposts,
            replies: e.replies,
            quotes: e.quotes,
            views: e.views,
            posts_count: e.posts_count,
            engagement_rate: e.engagement_rate,
          })),
          scores: scores.map(s => ({
            ts: s.ts,
            twitter_score: s.twitter_score,
            grade: s.grade,
            components: s.components,
            early_signal: s.early_signal,
          })),
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'READ_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/timeseries/:account_id/summary
   * Get aggregated summary for an account
   */
  app.get('/:account_id/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const { account_id } = req.params as { account_id: string };
    const query = req.query as { window?: string };
    
    const window = query.window || `${timeseriesAdminConfig.default_window}d`;
    
    try {
      const summary = await computeTimeSeriesSummary(account_id, window);
      
      if (!summary) {
        return reply.status(404).send({
          ok: false,
          error: 'NO_DATA',
          message: `No time series data found for account: ${account_id}`,
        });
      }
      
      return reply.send({
        ok: true,
        data: summary,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'SUMMARY_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/timeseries/top/breakouts
   * Get accounts with most breakouts
   */
  app.get('/top/breakouts', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { limit?: string; window?: string };
    
    const limit = Math.min(parseInt(query.limit || '10'), 50);
    const window = query.window || `${timeseriesAdminConfig.default_window}d`;
    
    try {
      const accounts = await getTopBreakoutAccounts(limit, window);
      
      return reply.send({
        ok: true,
        data: {
          window,
          accounts,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'BREAKOUTS_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/timeseries/stats
   * Get overall time series statistics
   */
  app.get('/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const [followersCount, engagementCount, scoresCount, uniqueAccounts] = await Promise.all([
        TSFollowersModel.countDocuments(),
        TSEngagementModel.countDocuments(),
        TSScoresModel.countDocuments(),
        TSFollowersModel.distinct('account_id'),
      ]);
      
      return reply.send({
        ok: true,
        data: {
          unique_accounts: uniqueAccounts.length,
          total_points: {
            followers: followersCount,
            engagement: engagementCount,
            scores: scoresCount,
            total: followersCount + engagementCount + scoresCount,
          },
          config: {
            default_window: timeseriesAdminConfig.default_window,
            retention_days: timeseriesAdminConfig.retention_days,
            mock_seeding_enabled: timeseriesAdminConfig.mock_seeding_enabled,
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'STATS_ERROR',
        message: error.message,
      });
    }
  });
  
  console.log('[Timeseries] Routes registered: /api/connections/timeseries/*');
}
