/**
 * Twitter Adapter Admin Routes
 * 
 * Admin endpoints for controlling Twitter → Connections adapter.
 * 
 * Prefix: /api/admin/connections/twitter-adapter
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getAdapterConfig,
  updateAdapterConfig,
  resetAdapterConfig,
  type TwitterAdapterConfig,
  type AdapterMode,
} from '../adapter/twitter-adapter.config.js';
import {
  processAuthors,
  processEngagements,
  processFollowEdges,
  getAdapterStatus,
  runDryRunDiff,
} from '../adapter/twitter-adapter.service.js';
import type { TwitterAuthorSnapshot, TwitterEngagementEvent, TwitterFollowEdge } from '../contracts/index.js';

export async function registerTwitterAdapterRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /status
   * Get adapter status and stats
   */
  app.get('/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const status = getAdapterStatus();
    return reply.send({
      ok: true,
      data: status,
    });
  });
  
  /**
   * GET /config
   * Get current configuration
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = getAdapterConfig();
    return reply.send({
      ok: true,
      data: config,
    });
  });
  
  /**
   * PATCH /config
   * Update configuration
   */
  app.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const updates = req.body as Partial<TwitterAdapterConfig>;
    
    try {
      const newConfig = updateAdapterConfig(updates);
      return reply.send({
        ok: true,
        message: 'Configuration updated',
        data: newConfig,
      });
    } catch (err: any) {
      return reply.status(400).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * POST /config/reset
   * Reset to default configuration
   */
  app.post('/config/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = resetAdapterConfig();
    return reply.send({
      ok: true,
      message: 'Configuration reset to defaults',
      data: config,
    });
  });
  
  /**
   * POST /mode
   * Quick mode switch (off | dry-run | live)
   */
  app.post('/mode', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { mode: AdapterMode };
    
    if (!['off', 'dry-run', 'live'].includes(body.mode)) {
      return reply.status(400).send({
        ok: false,
        error: 'Invalid mode. Must be: off | dry-run | live',
      });
    }
    
    const enabled = body.mode !== 'off';
    const config = updateAdapterConfig({ enabled, mode: body.mode });
    
    return reply.send({
      ok: true,
      message: `Adapter mode set to: ${body.mode}`,
      data: { enabled: config.enabled, mode: config.mode },
    });
  });
  
  /**
   * POST /dry-run
   * Run adapter in dry-run mode with provided data
   * Returns what would be written without actually writing
   */
  app.post('/dry-run', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      authors?: TwitterAuthorSnapshot[];
      engagements?: TwitterEngagementEvent[];
      edges?: TwitterFollowEdge[];
    };
    
    // Temporarily force dry-run mode
    const originalConfig = getAdapterConfig();
    updateAdapterConfig({ enabled: true, mode: 'dry-run' });
    
    const results: any = {};
    
    try {
      if (body.authors?.length) {
        // Convert string dates to Date objects
        const authors = body.authors.map(a => ({
          ...a,
          collected_at: new Date(a.collected_at),
          account_created_at: a.account_created_at ? new Date(a.account_created_at) : undefined,
        }));
        results.authors = await processAuthors(authors);
      }
      
      if (body.engagements?.length) {
        const engagements = body.engagements.map(e => ({
          ...e,
          tweet_timestamp: new Date(e.tweet_timestamp),
          collected_at: new Date(e.collected_at),
        }));
        results.engagements = await processEngagements(engagements);
      }
      
      if (body.edges?.length) {
        const edges = body.edges.map(e => ({
          ...e,
          discovered_at: new Date(e.discovered_at),
        }));
        results.edges = await processFollowEdges(edges);
      }
      
      // Restore original config
      updateAdapterConfig(originalConfig);
      
      return reply.send({
        ok: true,
        mode: 'dry-run',
        data: results,
      });
    } catch (err: any) {
      // Restore original config
      updateAdapterConfig(originalConfig);
      
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /diff/:author_id
   * Compare mock vs twitter-based score for an author
   */
  app.get('/diff/:author_id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { author_id } = req.params as { author_id: string };
    
    try {
      // TODO: Fetch actual twitter data from storage
      const diff = await runDryRunDiff(author_id, {});
      
      return reply.send({
        ok: true,
        data: diff,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * POST /reset-dedup
   * Clear deduplication cache (for testing)
   */
  app.post('/reset-dedup', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { clearDedupCache, getDedupStats } = await import('../safety/dedup.guard.js');
    clearDedupCache();
    return reply.send({
      ok: true,
      message: 'Dedup cache cleared',
      data: getDedupStats(),
    });
  });

  /**
   * POST /sources
   * Toggle data sources
   */
  app.post('/sources', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      followers?: boolean;
      engagements?: boolean;
      graph?: boolean;
    };
    
    const config = updateAdapterConfig({ sources: body });
    
    return reply.send({
      ok: true,
      message: 'Sources updated',
      data: config.sources,
    });
  });
  
  await registerAdditionalTwitterAdapterRoutes(app);
  console.log('[TwitterAdapter Admin] Routes registered: /api/admin/connections/twitter-adapter/*');
}

/**
 * Additional routes for Twitter Adapter (Phase T0-T1)
 */

import { getMongoDb } from '../../../../../db/mongoose.js';
import { readAllTwitterData } from '../adapter/twitter-adapter.service.js';
import { checkDataAvailability, getQuickDiffSummary } from '../../../ports/port-access.js';
import { getFollowGraphStatus } from '../readers/twitterFollow.reader.js';

export async function registerAdditionalTwitterAdapterRoutes(app: any) {
  
  // GET /coverage - Coverage statistics
  app.get('/coverage', async () => {
    const db = getMongoDb();
    const config = getAdapterConfig();
    
    if (!config.enabled) {
      return { ok: true, data: { enabled: false, coverage: null } };
    }

    const data = await readAllTwitterData(db);
    
    return {
      ok: true,
      data: {
        enabled: true,
        mode: config.mode,
        coverage: {
          authors: { count: data.coverage.authors_count, percentage: data.coverage.authors_pct },
          engagements: { count: data.coverage.engagements_count, percentage: data.coverage.engagements_pct },
          edges: { count: 0, percentage: 0, status: 'DISABLED' },
        },
        freshness: data.freshness,
        confidence_hints: data.confidence_hints,
      },
    };
  });

  // GET /quick-diff - Quick diff summary
  app.get('/quick-diff', async () => {
    const db = getMongoDb();
    const summary = await getQuickDiffSummary(db);
    return { ok: true, data: summary };
  });

  // POST /enable - Enable adapter
  app.post('/enable', async () => {
    const config = updateAdapterConfig({ enabled: true, mode: 'dry-run' });
    console.log('[TwitterAdapterAdmin] Adapter enabled');
    return { ok: true, data: { enabled: config.enabled, mode: config.mode } };
  });

  // POST /disable - Disable adapter  
  app.post('/disable', async () => {
    const config = updateAdapterConfig({ enabled: false, mode: 'off' });
    console.log('[TwitterAdapterAdmin] Adapter disabled');
    return { ok: true, data: { enabled: config.enabled, mode: config.mode } };
  });

  // GET /graph-status - Graph availability status
  app.get('/graph-status', async () => {
    const graphStatus = getFollowGraphStatus();
    return { ok: true, data: graphStatus };
  });

  // GET /data-availability - Check if Twitter data is available
  app.get('/data-availability', async () => {
    const db = getMongoDb();
    const availability = await checkDataAvailability(db);
    return { ok: true, data: availability };
  });

  // GET /full-status - Comprehensive status including data
  app.get('/full-status', async () => {
    const db = getMongoDb();
    const config = getAdapterConfig();
    const status = getAdapterStatus();
    const availability = await checkDataAvailability(db);
    const graphStatus = getFollowGraphStatus();
    
    let dataStats = null;
    if (config.enabled && availability.available) {
      const data = await readAllTwitterData(db);
      dataStats = {
        authors_count: data.coverage.authors_count,
        engagements_count: data.coverage.engagements_count,
        freshness: data.freshness,
        warnings: data.warnings,
      };
    }

    const confidence = getTwitterAdapterConfidence(
      availability.available,
      dataStats?.authors_count || 0,
      dataStats?.engagements_count || 0,
      dataStats?.freshness?.authors_avg_hours || 0
    );

    return {
      ok: true,
      data: {
        adapter: status,
        config: {
          enabled: config.enabled,
          mode: config.mode,
          read_only: config.read_only,
          writes_disabled: config.writes_disabled,
          alerts_disabled: config.alerts_disabled,
        },
        sources: {
          primary_collection: config.source_collections.primary,
          authors: { status: status.readers.authors, from: config.source_collections.authors_from },
          engagements: { status: status.readers.engagements, from: config.source_collections.engagements_from },
          graph: { status: 'disabled', from: 'disabled', reason: graphStatus.reason },
        },
        data: {
          available: availability.available,
          tweet_count: availability.tweet_count,
          author_count: availability.author_count,
          newest_at: availability.newest_at,
          stats: dataStats,
        },
        confidence: {
          score: confidence.score,
          label: confidence.capped ? 'CAPPED' : 'OK',
          capped: confidence.capped,
          cap_reason: confidence.cap_reason,
        },
        graph_status: graphStatus,
      },
    };
  });


  // GET /mock-vs-live - Full mock vs live comparison
  app.get('/mock-vs-live', async (req: any) => {
    const db = getMongoDb();
    const query = req.query as { mock_authors?: string; mock_engagements?: string };
    
    const mockData = {
      authors_count: parseInt(query.mock_authors || '10'),
      engagements_count: parseInt(query.mock_engagements || '100'),
      avg_score: 0.6,
      confidence: 0.7,
    };

    const diff = await compareMockVsLive(db, mockData);
    
    return { ok: true, data: diff };
  });

  // GET /pattern-analysis - Analyze engagement patterns by author
  app.get('/pattern-analysis', async () => {
    const db = getMongoDb();
    const collection = db.collection('twitter_results');
    
    const patterns = await collection.aggregate([
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          followers: { $first: '$author.followers' },
          tweet_count: { $sum: 1 },
          total_likes: { $sum: '$likes' },
          total_reposts: { $sum: '$reposts' },
          total_replies: { $sum: '$replies' },
          total_views: { $sum: '$views' },
          avg_likes: { $avg: '$likes' },
          max_likes: { $max: '$likes' },
          min_likes: { $min: '$likes' },
        }
      },
      {
        $addFields: {
          engagement_rate: {
            $cond: [
              { $gt: ['$total_views', 0] },
              { $divide: [{ $add: ['$total_likes', '$total_reposts', '$total_replies'] }, '$total_views'] },
              0
            ]
          },
          like_variance: { $subtract: ['$max_likes', '$min_likes'] },
          repost_ratio: {
            $cond: [
              { $gt: ['$total_likes', 0] },
              { $divide: ['$total_reposts', '$total_likes'] },
              0
            ]
          },
        }
      },
      {
        $addFields: {
          pattern: {
            $switch: {
              branches: [
                { case: { $and: [{ $gt: ['$avg_likes', 2000] }, { $lt: ['$repost_ratio', 0.05] }] }, then: 'BOT_SUSPECTED' },
                { case: { $gt: ['$like_variance', 5000] }, then: 'BREAKOUT' },
                { case: { $lt: ['$avg_likes', 20] }, then: 'FLAT' },
                { case: { $and: [{ $lt: ['$followers', 2000] }, { $gt: ['$repost_ratio', 0.3] }] }, then: 'SMART_NO_NAME' },
              ],
              default: 'NORMAL'
            }
          }
        }
      },
      { $sort: { engagement_rate: -1 } }
    ]).toArray();

    const summary = patterns.reduce((acc: any, p: any) => {
      acc[p.pattern] = (acc[p.pattern] || 0) + 1;
      return acc;
    }, {});

    return {
      ok: true,
      data: {
        authors: patterns.map((p: any) => ({
          author_id: p._id,
          username: p.username,
          followers: p.followers,
          tweets: p.tweet_count,
          engagement_rate: p.engagement_rate.toFixed(4),
          repost_ratio: p.repost_ratio.toFixed(4),
          pattern: p.pattern,
          avg_likes: Math.round(p.avg_likes),
          max_likes: p.max_likes,
        })),
        summary,
        total_authors: patterns.length,
      }
    };
  });

  // GET /top-deltas - Top 10 mock vs live deltas
  app.get('/top-deltas', async () => {
    const db = getMongoDb();
    
    const liveData = await db.collection('twitter_results').aggregate([
      {
        $group: {
          _id: '$author.id',
          username: { $first: '$author.username' },
          live_tweets: { $sum: 1 },
          live_engagement: { $sum: { $add: ['$likes', '$reposts', '$replies'] } },
          live_views: { $sum: '$views' },
        }
      },
      { $sort: { live_engagement: -1 } },
      { $limit: 10 }
    ]).toArray();

    const deltas = liveData.map((live: any) => {
      const mockEngagement = live.live_tweets * 50;
      const delta = live.live_engagement - mockEngagement;
      const deltaPct = mockEngagement > 0 ? (delta / mockEngagement) * 100 : 0;
      
      return {
        author_id: live._id,
        username: live.username,
        live_engagement: live.live_engagement,
        mock_engagement: mockEngagement,
        delta,
        delta_pct: deltaPct.toFixed(1) + '%',
        direction: delta > 0 ? 'ABOVE_MOCK' : delta < 0 ? 'BELOW_MOCK' : 'MATCH',
        severity: Math.abs(deltaPct) > 100 ? 'HIGH' : Math.abs(deltaPct) > 50 ? 'MEDIUM' : 'LOW',
      };
    });

    return {
      ok: true,
      data: {
        deltas,
        summary: {
          above_mock: deltas.filter((d: any) => d.direction === 'ABOVE_MOCK').length,
          below_mock: deltas.filter((d: any) => d.direction === 'BELOW_MOCK').length,
          high_severity: deltas.filter((d: any) => d.severity === 'HIGH').length,
        }
      }
    };
  });


  // GET /co-engagement-graph - Build co-engagement graph
  app.get('/co-engagement-graph', async () => {
    const db = getMongoDb();
    const { buildCoEngagementGraph } = await import('../../../graph/coEngagement.builder.js');
    const graph = await buildCoEngagementGraph(db, { max_edges: 50 });
    return { ok: true, data: graph };
  });

  // GET /graph-overlay - Get combined graph overlay
  app.get('/graph-overlay', async (req: any) => {
    const db = getMongoDb();
    const query = req.query as { mode?: string };
    const mode = (query.mode || 'blended') as 'mock_only' | 'live_only' | 'blended';
    
    const { buildGraphOverlay } = await import('../../../graph/graphOverlay.builder.js');
    const overlay = await buildGraphOverlay(db, mode, { max_edges: 100 });
    return { ok: true, data: overlay };
  });


  // GET /blend - Calculate blended scores
  app.get('/blend', async () => {
    const db = getMongoDb();
    const { calculateBlendedScores } = await import('../blend/partialBlend.service.js');
    const result = await calculateBlendedScores(db);
    return { ok: true, data: result };
  });

  // GET /blend-config - Get blend configuration
  app.get('/blend-config', async () => {
    const { getBlendConfig } = await import('../blend/partialBlend.service.js');
    return { ok: true, data: getBlendConfig() };
  });

  // POST /blend-config - Update blend configuration
  app.post('/blend-config', async (req: any) => {
    const body = req.body as any;
    const { updateBlendConfig, getBlendConfig } = await import('../blend/partialBlend.service.js');
    updateBlendConfig(body);
    return { ok: true, data: getBlendConfig() };
  });

  // GET /preview - Preview mock vs live vs blended for all authors
  app.get('/preview', async () => {
    const db = getMongoDb();
    const { calculateBlendedScores } = await import('../blend/partialBlend.service.js');
    const blend = await calculateBlendedScores(db);
    
    return {
      ok: true,
      data: {
        preview: blend.results.map(r => ({
          author: r.author_id,
          username: r.username,
          mock: r.mock_score.toFixed(3),
          live_eng: r.live_engagement_score.toFixed(3),
          live_trend: r.live_trend_score.toFixed(3),
          blended: r.blended_score.toFixed(3),
          delta: (r.blended_score - r.mock_score).toFixed(3),
          blend_applied: r.blend_applied,
          confidence: (r.confidence * 100).toFixed(0) + '%',
        })),
        summary: blend.stats,
        config: blend.config,
      }
    };
  });

  console.log('[TwitterAdapter Admin] Additional routes registered');
}
