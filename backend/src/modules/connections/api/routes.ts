/**
 * Connections API Routes
 * 
 * Prefix: /api/connections
 * 
 * Endpoints:
 * - GET /health - Module health
 * - GET /stats - Statistics
 * - GET /accounts - List profiles
 * - GET /accounts/:author_id - Get single profile
 * - POST /compare - Compare two accounts (overlap)
 * - POST /test/ingest - Test tweet ingestion
 * - AI Summary endpoints (Phase 3.5)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  listAuthorProfiles, 
  getAuthorProfile,
  getAuthorProfileByHandle,
  getStoreStats 
} from '../storage/author-profile.store.js';
import { connectionsAdminConfig } from '../admin/connections-admin.js';
import { computeDirectionalOverlap, interpretOverlap } from '../core/scoring/compute-overlap.js';

// Phase 3.5: AI imports
import { 
  AiSummaryService, 
  registerAiRoutes, 
  setAiService,
  registerAiAdminRoutes,
  setAiServiceForAdmin,
} from '../ai/index.js';

export async function registerConnectionsRoutes(app: FastifyInstance): Promise<void> {
  // Health check
  app.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      module: 'connections',
      enabled: connectionsAdminConfig.enabled,
      features: {
        influence_score: connectionsAdminConfig.influence_score_enabled,
        risk_detection: connectionsAdminConfig.risk_detection_enabled,
      },
      storage: 'mongodb',
    });
  });

  // Stats
  app.get('/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    const stats = await getStoreStats();
    return reply.send({
      ok: true,
      data: {
        total_profiles: stats.count,
        storage: 'mongodb',
        config: {
          enabled: connectionsAdminConfig.enabled,
          thresholds: connectionsAdminConfig.thresholds,
        },
      },
    });
  });

  // List accounts (with sorting & pagination)
  app.get('/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      sort_by?: string;
      order?: string;
      limit?: string;
      offset?: string;
    };

    const result = await listAuthorProfiles({
      sortBy: (query.sort_by as any) ?? 'influence_score',
      order: (query.order as any) ?? 'desc',
      limit: Math.min(parseInt(query.limit ?? '50'), connectionsAdminConfig.max_results_per_page),
      offset: parseInt(query.offset ?? '0'),
    });

    return reply.send({
      ok: true,
      data: result,
    });
  });

  // Get single account by ID
  app.get('/accounts/:author_id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { author_id } = req.params as { author_id: string };
    
    const profile = await getAuthorProfile(author_id);
    
    if (!profile) {
      return reply.status(404).send({
        ok: false,
        error: 'PROFILE_NOT_FOUND',
        message: `No profile found for author_id: ${author_id}`,
      });
    }

    return reply.send({
      ok: true,
      data: profile,
    });
  });

  // Compare two accounts (overlap scoring)
  app.post('/compare', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { 
      left?: string; 
      right?: string;
      author_ids?: string[];
    };
    
    // Support two formats:
    // 1. { left: "handle1", right: "handle2" }
    // 2. { author_ids: ["handle1", "handle2"] }
    
    let leftHandle: string | undefined;
    let rightHandle: string | undefined;
    
    if (body.left && body.right) {
      leftHandle = body.left;
      rightHandle = body.right;
    } else if (body.author_ids && body.author_ids.length >= 2) {
      leftHandle = body.author_ids[0];
      rightHandle = body.author_ids[1];
    }
    
    if (!leftHandle || !rightHandle) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'Either {left, right} or {author_ids: [a, b]} required',
      });
    }

    // Try to find by handle first, then by author_id
    let left = await getAuthorProfileByHandle(leftHandle);
    if (!left) left = await getAuthorProfile(leftHandle);
    
    let right = await getAuthorProfileByHandle(rightHandle);
    if (!right) right = await getAuthorProfile(rightHandle);
    
    if (!left || !right) {
      return reply.status(404).send({
        ok: false,
        error: 'PROFILE_NOT_FOUND',
        message: `Profile not found: ${!left ? leftHandle : ''} ${!right ? rightHandle : ''}`.trim(),
      });
    }

    // Get engaged user IDs
    const aIds = left.audience?.engaged_user_ids ?? [];
    const bIds = right.audience?.engaged_user_ids ?? [];
    
    // Compute overlap
    const overlap = computeDirectionalOverlap(aIds, bIds);
    const interpretation = interpretOverlap(overlap);
    
    return reply.send({
      ok: true,
      data: {
        left: {
          author_id: left.author_id,
          handle: left.handle,
          influence_score: left.scores?.influence_score ?? 0,
          active_audience_size: aIds.length,
        },
        right: {
          author_id: right.author_id,
          handle: right.handle,
          influence_score: right.scores?.influence_score ?? 0,
          active_audience_size: bIds.length,
        },
        audience_overlap: {
          a_to_b: overlap.a_to_b,
          b_to_a: overlap.b_to_a,
          shared_users: overlap.shared,
          jaccard_similarity: overlap.jaccard,
          window: `${left.audience?.window_days ?? 30}d`,
        },
        interpretation,
      },
    });
  });

  // Test endpoint: Manually ingest a tweet for testing
  app.post('/test/ingest', async (req: FastifyRequest, reply: FastifyReply) => {
    const { processTwitterPostForConnections } = await import('../core/index.js');
    
    const mockPost = req.body as any;
    
    // Validate minimal required fields
    if (!mockPost.author?.author_id && !mockPost.author_id) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'author.author_id or author_id required',
      });
    }

    try {
      await processTwitterPostForConnections(mockPost);
      
      const authorId = mockPost.author?.author_id || mockPost.author_id;
      const profile = await getAuthorProfile(authorId);
      
      return reply.send({
        ok: true,
        message: 'Tweet processed for Connections',
        data: profile,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'PROCESSING_ERROR',
        message: error.message,
      });
    }
  });

  // Test endpoint: Add engaged users for overlap testing
  app.post('/test/add-audience', async (req: FastifyRequest, reply: FastifyReply) => {
    const { mergeAudience } = await import('../storage/author-profile.store.js');
    
    const body = req.body as {
      author_id: string;
      handle?: string;
      engaged_user_ids: string[];
    };
    
    if (!body.author_id || !Array.isArray(body.engaged_user_ids)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'author_id and engaged_user_ids[] required',
      });
    }

    try {
      await mergeAudience(
        body.author_id, 
        body.handle || 'unknown', 
        body.engaged_user_ids
      );
      
      const profile = await getAuthorProfile(body.author_id);
      
      return reply.send({
        ok: true,
        message: `Added ${body.engaged_user_ids.length} engaged users`,
        data: {
          author_id: body.author_id,
          total_audience: profile?.audience?.engaged_user_ids?.length ?? 0,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'PROCESSING_ERROR',
        message: error.message,
      });
    }
  });

  // ============================================================
  // SCORING ENGINE v0 (Abstract, NO Twitter dependency)
  // ============================================================

  /**
   * POST /api/connections/score
   * 
   * Compute scores from abstract input data.
   * Can be used with mock data for UI development.
   * 
   * Body: ConnectionsInput
   * Returns: ConnectionsScoreResult
   */
  app.post('/score', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeConnectionsScore } = await import('../core/scoring/connections-engine.js');
    
    const input = req.body as any;
    
    // Validate minimal required fields
    if (!input.author_id) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'author_id required',
      });
    }
    
    if (!Array.isArray(input.posts)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'posts[] array required',
      });
    }

    try {
      const result = computeConnectionsScore(input);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'SCORING_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/connections/score/batch
   * 
   * Compute scores for multiple authors at once.
   */
  app.post('/score/batch', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeConnectionsScore } = await import('../core/scoring/connections-engine.js');
    
    const body = req.body as { inputs: any[] };
    
    if (!Array.isArray(body.inputs)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'inputs[] array required',
      });
    }

    try {
      const results = body.inputs.map(input => ({
        author_id: input.author_id,
        result: computeConnectionsScore(input),
      }));
      
      return reply.send({
        ok: true,
        data: results,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'SCORING_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/score/mock
   * 
   * Returns a mock score result for UI development.
   */
  app.get('/score/mock', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { computeConnectionsScore } = await import('../core/scoring/connections-engine.js');
    const { explainScore } = await import('../core/scoring/connections-explain.js');
    
    // Mock input for testing
    const mockInput = {
      author_id: 'mock_whale_001',
      window_days: 30,
      followers_now: 50000,
      followers_then: 45000,
      posts: [
        { views: 120000, likes: 3500, reposts: 800, replies: 450, created_at: '2026-02-01T10:00:00Z' },
        { views: 95000, likes: 2800, reposts: 600, replies: 320, created_at: '2026-02-02T14:00:00Z' },
        { views: 150000, likes: 4200, reposts: 1100, replies: 680, created_at: '2026-02-03T09:00:00Z' },
        { views: 88000, likes: 2400, reposts: 500, replies: 280, created_at: '2026-02-04T16:00:00Z' },
        { views: 200000, likes: 5500, reposts: 1400, replies: 920, created_at: '2026-02-05T11:00:00Z' },
        { views: 75000, likes: 2000, reposts: 400, replies: 200, created_at: '2026-02-06T13:00:00Z' },
        { views: 110000, likes: 3100, reposts: 700, replies: 380, created_at: '2026-02-07T10:00:00Z' },
      ],
    };
    
    const result = computeConnectionsScore(mockInput);
    const explanation = explainScore(result);
    
    return reply.send({
      ok: true,
      message: 'Mock score for UI development',
      input: mockInput,
      data: result,
      explanation,
    });
  });

  // ============================================================
  // CONFIG & SENSITIVITY & EXPLAIN API
  // ============================================================

  /**
   * GET /api/connections/config
   * Returns current scoring config
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { ConnectionsScoringConfig } = await import('../core/scoring/connections-config.js');
    return reply.send({
      ok: true,
      data: ConnectionsScoringConfig,
    });
  });

  /**
   * POST /api/connections/sensitivity
   * Compute sensitivity analysis for input
   */
  app.post('/sensitivity', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeSensitivity } = await import('../core/scoring/connections-sensitivity.js');
    
    const input = req.body as any;
    
    if (!input.author_id || !Array.isArray(input.posts)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'author_id and posts[] required',
      });
    }

    try {
      const result = computeSensitivity(input);
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'SENSITIVITY_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/connections/explain
   * Get human-readable explanation for a score
   */
  app.post('/explain', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeConnectionsScore } = await import('../core/scoring/connections-engine.js');
    const { explainScore } = await import('../core/scoring/connections-explain.js');
    
    const input = req.body as any;
    
    if (!input.author_id || !Array.isArray(input.posts)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'author_id and posts[] required',
      });
    }

    try {
      const score = computeConnectionsScore(input);
      const explanation = explainScore(score);
      
      return reply.send({
        ok: true,
        data: {
          score: {
            influence_score: score.influence_score,
            x_score: score.x_score,
            risk_level: score.risk_level,
          },
          explanation,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'EXPLAIN_ERROR',
        message: error.message,
      });
    }
  });

  // ============================================================
  // COMPARE EXPLAIN API
  // ============================================================

  /**
   * POST /api/connections/compare/explain
   * 
   * Explains WHY account A scores higher/lower than B.
   * Body: { a: ConnectionsInput, b: ConnectionsInput, score_type?: 'influence' | 'x' }
   */
  app.post('/compare/explain', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeConnectionsScore } = await import('../core/scoring/connections-engine.js');
    const { explainCompare } = await import('../core/scoring/compare-explain-engine.js');
    
    const body = req.body as {
      a: any;
      b: any;
      score_type?: 'influence' | 'x';
    };
    
    // Validate inputs
    if (!body.a?.author_id || !Array.isArray(body.a?.posts)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'a.author_id and a.posts[] required',
      });
    }
    
    if (!body.b?.author_id || !Array.isArray(body.b?.posts)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'b.author_id and b.posts[] required',
      });
    }

    try {
      const scoreA = computeConnectionsScore(body.a);
      const scoreB = computeConnectionsScore(body.b);
      const scoreType = body.score_type || 'influence';
      
      const explanation = explainCompare({
        scoreType,
        A: {
          score: scoreType === 'influence' ? scoreA.influence_score : scoreA.x_score,
          profileType: scoreA.profile,
          components: scoreA.explain.components,
        },
        B: {
          score: scoreType === 'influence' ? scoreB.influence_score : scoreB.x_score,
          profileType: scoreB.profile,
          components: scoreB.explain.components,
        },
        weights: scoreA.explain.weights,
      });
      
      return reply.send({
        ok: true,
        data: {
          scores: {
            a: {
              author_id: body.a.author_id,
              influence_score: scoreA.influence_score,
              x_score: scoreA.x_score,
              profile: scoreA.profile,
            },
            b: {
              author_id: body.b.author_id,
              influence_score: scoreB.influence_score,
              x_score: scoreB.x_score,
              profile: scoreB.profile,
            },
          },
          explanation,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'COMPARE_EXPLAIN_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/compare/explain/mock
   * 
   * Returns a mock compare explanation for UI development.
   */
  app.get('/compare/explain/mock', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { computeConnectionsScore } = await import('../core/scoring/connections-engine.js');
    const { explainCompare } = await import('../core/scoring/compare-explain-engine.js');
    
    // Mock input A: Whale account (large followers)
    const mockA = {
      author_id: 'mock_whale_001',
      window_days: 30,
      followers_now: 600000,
      posts: [
        { views: 150000, likes: 4500, reposts: 1200, replies: 700, created_at: '2026-02-01T10:00:00Z' },
        { views: 180000, likes: 5200, reposts: 1400, replies: 850, created_at: '2026-02-02T14:00:00Z' },
        { views: 120000, likes: 3800, reposts: 900, replies: 520, created_at: '2026-02-03T09:00:00Z' },
      ],
    };
    
    // Mock input B: Retail account (smaller followers)
    const mockB = {
      author_id: 'mock_retail_001',
      window_days: 30,
      followers_now: 15000,
      posts: [
        { views: 8000, likes: 450, reposts: 120, replies: 85, created_at: '2026-02-01T11:00:00Z' },
        { views: 12000, likes: 680, reposts: 180, replies: 110, created_at: '2026-02-02T15:00:00Z' },
        { views: 6500, likes: 320, reposts: 80, replies: 60, created_at: '2026-02-03T10:00:00Z' },
      ],
    };
    
    const scoreA = computeConnectionsScore(mockA);
    const scoreB = computeConnectionsScore(mockB);
    
    const explanation = explainCompare({
      scoreType: 'influence',
      A: {
        score: scoreA.influence_score,
        profileType: scoreA.profile,
        components: scoreA.explain.components,
      },
      B: {
        score: scoreB.influence_score,
        profileType: scoreB.profile,
        components: scoreB.explain.components,
      },
      weights: scoreA.explain.weights,
    });
    
    return reply.send({
      ok: true,
      message: 'Mock compare explanation for UI development',
      data: {
        inputs: { a: mockA, b: mockB },
        scores: {
          a: {
            author_id: mockA.author_id,
            influence_score: scoreA.influence_score,
            x_score: scoreA.x_score,
            profile: scoreA.profile,
          },
          b: {
            author_id: mockB.author_id,
            influence_score: scoreB.influence_score,
            x_score: scoreB.x_score,
            profile: scoreB.profile,
          },
        },
        explanation,
      },
    });
  });

  /**
   * GET /api/connections/profiles
   * 
   * Returns all available scoring profiles with their configs.
   */
  app.get('/profiles', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { ScoringProfiles, getAllProfiles } = await import('../core/scoring/connections-profiles.js');
    const { getProfileThresholds } = await import('../core/scoring/profile-resolver.js');
    
    const thresholds = getProfileThresholds();
    const profiles = getAllProfiles().map(type => ({
      type,
      ...ScoringProfiles[type],
      thresholds: thresholds[type],
    }));
    
    return reply.send({
      ok: true,
      data: profiles,
    });
  });

  // ============================================================
  // TRENDS API (Velocity & Acceleration)
  // ============================================================

  /**
   * POST /api/connections/trends
   * 
   * Compute velocity and acceleration from score history.
   * Body: { author_id, window_days, series: [{ts, influence, x_score?}] }
   */
  app.post('/trends', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeTrends, computeFullTrends } = await import('../core/scoring/connections-trends.js');
    const { explainTrends, getTrendBadge } = await import('../core/scoring/connections-trends-explain.js');
    
    const body = req.body as {
      author_id: string;
      window_days?: number;
      series: Array<{ ts: number; influence: number; x_score?: number }>;
      include_x?: boolean;
    };
    
    if (!body.author_id) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'author_id required',
      });
    }
    
    if (!Array.isArray(body.series) || body.series.length < 2) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'series[] array with at least 2 points required',
      });
    }

    try {
      const input = {
        author_id: body.author_id,
        window_days: body.window_days || 30,
        series: body.series,
      };
      
      if (body.include_x) {
        const trends = computeFullTrends(input);
        return reply.send({
          ok: true,
          data: {
            author_id: body.author_id,
            influence: {
              ...trends.influence,
              badge: getTrendBadge(trends.influence),
              explanation: explainTrends(trends.influence),
            },
            x: {
              ...trends.x,
              badge: getTrendBadge(trends.x),
              explanation: explainTrends(trends.x),
            },
          },
        });
      }
      
      const trend = computeTrends(input);
      const explanation = explainTrends(trend);
      const badge = getTrendBadge(trend);
      
      return reply.send({
        ok: true,
        data: {
          author_id: body.author_id,
          ...trend,
          badge,
          explanation,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TRENDS_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/trends/mock
   * 
   * Returns mock trend data for UI development.
   */
  app.get('/trends/mock', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeTrends, generateMockTrendSeries } = await import('../core/scoring/connections-trends.js');
    const { explainTrends, getTrendBadge } = await import('../core/scoring/connections-trends-explain.js');
    
    const query = req.query as { trend?: string };
    const trendType = (query.trend as 'up' | 'down' | 'stable' | 'volatile') || 'up';
    
    const series = generateMockTrendSeries(30, 500, trendType);
    const trend = computeTrends({
      author_id: 'mock_trending_001',
      window_days: 30,
      series,
    });
    
    return reply.send({
      ok: true,
      message: `Mock ${trendType} trend for UI development`,
      data: {
        author_id: 'mock_trending_001',
        ...trend,
        badge: getTrendBadge(trend),
        explanation: explainTrends(trend),
        series: series.slice(-10), // Last 10 points for sparkline
      },
    });
  });

  /**
   * POST /api/connections/trends/compare
   * 
   * Compare trends between two accounts.
   */
  app.post('/trends/compare', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeTrends } = await import('../core/scoring/connections-trends.js');
    const { compareTrends, getTrendBadge, explainTrends } = await import('../core/scoring/connections-trends-explain.js');
    
    const body = req.body as {
      a: { author_id: string; series: Array<{ ts: number; influence: number }> };
      b: { author_id: string; series: Array<{ ts: number; influence: number }> };
    };
    
    if (!body.a?.series || !body.b?.series) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'Both a.series and b.series required',
      });
    }

    try {
      const trendA = computeTrends({
        author_id: body.a.author_id,
        window_days: 30,
        series: body.a.series,
      });
      
      const trendB = computeTrends({
        author_id: body.b.author_id,
        window_days: 30,
        series: body.b.series,
      });
      
      const comparison = compareTrends(trendA, trendB);
      
      return reply.send({
        ok: true,
        data: {
          a: {
            author_id: body.a.author_id,
            ...trendA,
            badge: getTrendBadge(trendA),
          },
          b: {
            author_id: body.b.author_id,
            ...trendB,
            badge: getTrendBadge(trendB),
          },
          comparison,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TRENDS_COMPARE_ERROR',
        message: error.message,
      });
    }
  });

  // ============================================================
  // TREND-ADJUSTED SCORE API v0.5
  // ============================================================

  /**
   * POST /api/connections/trend-adjusted
   * 
   * Compute trend-adjusted scores from base scores + trend data.
   * Body: { influence_score, x_score, velocity_norm, acceleration_norm }
   */
  app.post('/trend-adjusted', async (req: FastifyRequest, reply: FastifyReply) => {
    const { applyFullTrendAdjustment } = await import('../core/scoring/trend-adjust.js');
    const { explainTrendAdjustment, getTrendAdjustBadge } = await import('../core/scoring/trend-adjust-explain.js');
    
    const body = req.body as {
      influence_score: number;
      x_score: number;
      velocity_norm: number;
      acceleration_norm: number;
      state?: 'growing' | 'cooling' | 'stable' | 'volatile';
    };
    
    if (body.influence_score === undefined || body.velocity_norm === undefined) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'influence_score and velocity_norm required',
      });
    }

    try {
      const result = applyFullTrendAdjustment({
        influence_score: body.influence_score,
        x_score: body.x_score ?? Math.round(body.influence_score * 0.6),
        velocity_norm: body.velocity_norm,
        acceleration_norm: body.acceleration_norm ?? 0,
      });
      
      return reply.send({
        ok: true,
        data: {
          influence: {
            ...result.influence,
            explanation: explainTrendAdjustment({ 
              ...result.influence, 
              state: body.state 
            }),
            badge: getTrendAdjustBadge({ 
              ...result.influence, 
              state: body.state 
            }),
          },
          x: {
            ...result.x,
            explanation: explainTrendAdjustment({ 
              ...result.x, 
              state: body.state 
            }),
            badge: getTrendAdjustBadge({ 
              ...result.x, 
              state: body.state 
            }),
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TREND_ADJUST_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/trend-adjusted/mock
   * 
   * Returns mock trend-adjusted data for UI development.
   */
  app.get('/trend-adjusted/mock', async (req: FastifyRequest, reply: FastifyReply) => {
    const { applyFullTrendAdjustment } = await import('../core/scoring/trend-adjust.js');
    const { explainTrendAdjustment, getTrendAdjustBadge } = await import('../core/scoring/trend-adjust-explain.js');
    const { ConnectionsTrendConfig } = await import('../core/scoring/connections-trend-config.js');
    
    const query = req.query as { scenario?: string };
    
    // Different scenarios for testing
    const scenarios = {
      growing: {
        influence_score: 580,
        x_score: 340,
        velocity_norm: 0.75,
        acceleration_norm: 0.35,
        state: 'growing' as const,
      },
      cooling: {
        influence_score: 720,
        x_score: 420,
        velocity_norm: -0.6,
        acceleration_norm: -0.25,
        state: 'cooling' as const,
      },
      volatile: {
        influence_score: 450,
        x_score: 280,
        velocity_norm: 0.15,
        acceleration_norm: 0.65,
        state: 'volatile' as const,
      },
      stable: {
        influence_score: 600,
        x_score: 350,
        velocity_norm: 0.05,
        acceleration_norm: -0.02,
        state: 'stable' as const,
      },
    };
    
    const scenario = scenarios[query.scenario as keyof typeof scenarios] || scenarios.growing;
    
    const result = applyFullTrendAdjustment({
      influence_score: scenario.influence_score,
      x_score: scenario.x_score,
      velocity_norm: scenario.velocity_norm,
      acceleration_norm: scenario.acceleration_norm,
    });
    
    return reply.send({
      ok: true,
      message: `Mock trend-adjusted score (${query.scenario || 'growing'} scenario)`,
      config: ConnectionsTrendConfig,
      input: scenario,
      data: {
        influence: {
          base: scenario.influence_score,
          ...result.influence,
          explanation: explainTrendAdjustment({ ...result.influence, state: scenario.state }),
          badge: getTrendAdjustBadge({ ...result.influence, state: scenario.state }),
        },
        x: {
          base: scenario.x_score,
          ...result.x,
          explanation: explainTrendAdjustment({ ...result.x, state: scenario.state }),
          badge: getTrendAdjustBadge({ ...result.x, state: scenario.state }),
        },
      },
    });
  });

  /**
   * POST /api/connections/trend-adjusted/compare
   * 
   * Compare two accounts by trend-adjusted scores.
   */
  app.post('/trend-adjusted/compare', async (req: FastifyRequest, reply: FastifyReply) => {
    const { applyTrendAdjustment } = await import('../core/scoring/trend-adjust.js');
    const { compareTrendAdjusted, getTrendAdjustBadge } = await import('../core/scoring/trend-adjust-explain.js');
    
    const body = req.body as {
      a: {
        influence_score: number;
        velocity_norm: number;
        acceleration_norm: number;
      };
      b: {
        influence_score: number;
        velocity_norm: number;
        acceleration_norm: number;
      };
    };
    
    if (!body.a?.influence_score || !body.b?.influence_score) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'Both a.influence_score and b.influence_score required',
      });
    }

    try {
      const adjustedA = applyTrendAdjustment({
        base_score: body.a.influence_score,
        velocity_norm: body.a.velocity_norm ?? 0,
        acceleration_norm: body.a.acceleration_norm ?? 0,
        score_type: 'influence',
      });
      
      const adjustedB = applyTrendAdjustment({
        base_score: body.b.influence_score,
        velocity_norm: body.b.velocity_norm ?? 0,
        acceleration_norm: body.b.acceleration_norm ?? 0,
        score_type: 'influence',
      });
      
      const comparison = compareTrendAdjusted({
        a: { 
          base: body.a.influence_score, 
          adjusted: adjustedA.adjusted_score,
          delta_percent: adjustedA.delta_percent,
        },
        b: { 
          base: body.b.influence_score, 
          adjusted: adjustedB.adjusted_score,
          delta_percent: adjustedB.delta_percent,
        },
      });
      
      return reply.send({
        ok: true,
        data: {
          a: {
            base: body.a.influence_score,
            ...adjustedA,
            badge: getTrendAdjustBadge({ ...adjustedA }),
          },
          b: {
            base: body.b.influence_score,
            ...adjustedB,
            badge: getTrendAdjustBadge({ ...adjustedB }),
          },
          comparison,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TREND_COMPARE_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/trend-adjusted/config
   * 
   * Returns current trend adjustment configuration.
   */
  app.get('/trend-adjusted/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { ConnectionsTrendConfig } = await import('../core/scoring/connections-trend-config.js');
    return reply.send({
      ok: true,
      data: ConnectionsTrendConfig,
    });
  });

  // ============================================================
  // EARLY SIGNAL DETECTOR API v1
  // ============================================================

  /**
   * POST /api/connections/early-signal
   * 
   * Compute early signal from existing data layers.
   * This is NOT a rating - it's a radar/watchlist layer.
   */
  app.post('/early-signal', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeEarlySignal } = await import('../core/scoring/early-signal.js');
    const { explainEarlySignal, getEarlySignalBadge, getWatchlistRecommendation } = await import('../core/scoring/early-signal-explain.js');
    
    const body = req.body as {
      influence_base: number;
      influence_adjusted: number;
      trend: {
        velocity_norm: number;
        acceleration_norm: number;
      };
      signal_noise?: number;
      risk_level?: 'low' | 'medium' | 'high';
      profile?: 'retail' | 'influencer' | 'whale';
    };
    
    if (body.influence_base === undefined || body.influence_adjusted === undefined) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'influence_base and influence_adjusted required',
      });
    }
    
    if (!body.trend?.velocity_norm === undefined) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'trend.velocity_norm required',
      });
    }

    try {
      const result = computeEarlySignal({
        influence_base: body.influence_base,
        influence_adjusted: body.influence_adjusted,
        trend: {
          velocity_norm: body.trend.velocity_norm,
          acceleration_norm: body.trend.acceleration_norm ?? 0,
        },
        signal_noise: body.signal_noise ?? 5,
        risk_level: body.risk_level ?? 'low',
        profile: body.profile ?? 'retail',
      });
      
      return reply.send({
        ok: true,
        data: {
          ...result,
          explanation: explainEarlySignal(result),
          badge_info: getEarlySignalBadge(result.badge),
          watchlist: getWatchlistRecommendation(result),
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'EARLY_SIGNAL_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/early-signal/mock
   * 
   * Returns mock early signal data for different scenarios.
   */
  app.get('/early-signal/mock', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeEarlySignal } = await import('../core/scoring/early-signal.js');
    const { explainEarlySignal, getEarlySignalBadge } = await import('../core/scoring/early-signal-explain.js');
    const { EarlySignalConfig } = await import('../core/scoring/early-signal-config.js');
    
    const query = req.query as { scenario?: string };
    
    const scenarios = {
      breakout: {
        influence_base: 480,
        influence_adjusted: 650,
        trend: { velocity_norm: 0.5, acceleration_norm: 0.65 },
        signal_noise: 6.5,
        risk_level: 'low' as const,
        profile: 'retail' as const,
      },
      rising: {
        influence_base: 550,
        influence_adjusted: 620,
        trend: { velocity_norm: 0.35, acceleration_norm: 0.25 },
        signal_noise: 5.0,
        risk_level: 'low' as const,
        profile: 'influencer' as const,
      },
      whale_no_signal: {
        influence_base: 750,
        influence_adjusted: 820,
        trend: { velocity_norm: 0.4, acceleration_norm: 0.3 },
        signal_noise: 4.0,
        risk_level: 'low' as const,
        profile: 'whale' as const,
      },
      risky: {
        influence_base: 400,
        influence_adjusted: 520,
        trend: { velocity_norm: 0.6, acceleration_norm: 0.5 },
        signal_noise: 8.0,
        risk_level: 'high' as const,
        profile: 'retail' as const,
      },
    };
    
    const scenario = scenarios[query.scenario as keyof typeof scenarios] || scenarios.breakout;
    const result = computeEarlySignal(scenario);
    
    return reply.send({
      ok: true,
      message: `Mock early signal (${query.scenario || 'breakout'} scenario)`,
      config: EarlySignalConfig,
      input: scenario,
      data: {
        ...result,
        explanation: explainEarlySignal(result),
        badge_info: getEarlySignalBadge(result.badge),
      },
    });
  });

  /**
   * POST /api/connections/early-signal/compare
   * 
   * Compare early signals between two accounts.
   */
  app.post('/early-signal/compare', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeEarlySignal } = await import('../core/scoring/early-signal.js');
    const { compareEarlySignals, getEarlySignalBadge } = await import('../core/scoring/early-signal-explain.js');
    
    const body = req.body as {
      a: {
        influence_base: number;
        influence_adjusted: number;
        trend: { velocity_norm: number; acceleration_norm: number };
        risk_level?: 'low' | 'medium' | 'high';
        profile?: 'retail' | 'influencer' | 'whale';
      };
      b: {
        influence_base: number;
        influence_adjusted: number;
        trend: { velocity_norm: number; acceleration_norm: number };
        risk_level?: 'low' | 'medium' | 'high';
        profile?: 'retail' | 'influencer' | 'whale';
      };
    };
    
    if (!body.a || !body.b) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'Both a and b accounts required',
      });
    }

    try {
      const resultA = computeEarlySignal({
        influence_base: body.a.influence_base,
        influence_adjusted: body.a.influence_adjusted,
        trend: body.a.trend,
        signal_noise: 5,
        risk_level: body.a.risk_level ?? 'low',
        profile: body.a.profile ?? 'retail',
      });
      
      const resultB = computeEarlySignal({
        influence_base: body.b.influence_base,
        influence_adjusted: body.b.influence_adjusted,
        trend: body.b.trend,
        signal_noise: 5,
        risk_level: body.b.risk_level ?? 'low',
        profile: body.b.profile ?? 'retail',
      });
      
      const comparison = compareEarlySignals(resultA, resultB);
      
      return reply.send({
        ok: true,
        data: {
          a: {
            ...resultA,
            badge_info: getEarlySignalBadge(resultA.badge),
          },
          b: {
            ...resultB,
            badge_info: getEarlySignalBadge(resultB.badge),
          },
          comparison,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'EARLY_SIGNAL_COMPARE_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/early-signal/config
   */
  app.get('/early-signal/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { EarlySignalConfig } = await import('../core/scoring/early-signal-config.js');
    return reply.send({
      ok: true,
      data: EarlySignalConfig,
    });
  });

  // ============================================================
  // RADAR ACCOUNTS API - Real data from unified_accounts
  // ============================================================

  /**
   * GET /api/connections/radar/accounts
   * 
   * Returns real accounts from unified_accounts with computed early signals.
   * Used by MarketRadar frontend component.
   */
  app.get('/radar/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { computeEarlySignal } = await import('../core/scoring/early-signal.js');
    const { getMongoDb } = await import('../../../db/mongoose.js');
    
    const query = req.query as {
      limit?: string;
      profile?: string;  // comma-separated: retail,influencer,whale
      minFollowers?: string;
    };
    
    const limit = Math.min(parseInt(query.limit || '100'), 200);
    const minFollowers = parseInt(query.minFollowers || '0');
    
    try {
      const db = getMongoDb();
      const collection = db.collection('connections_unified_accounts');
      
      // Build filter
      const filter: any = {};
      if (minFollowers > 0) {
        filter.followers = { $gte: minFollowers };
      }
      
      // Fetch accounts
      const accounts = await collection
        .find(filter)
        .sort({ followers: -1 })
        .limit(limit)
        .toArray();
      
      // Transform to radar format with early signals
      const radarAccounts = accounts.map(acc => {
        // Determine profile based on followers
        const followers = acc.followers || 0;
        const profile = followers >= 500000 ? 'whale' : followers >= 50000 ? 'influencer' : 'retail';
        
        // Calculate influence score (0-1000 scale)
        const influenceBase = Math.round((acc.influence || 0.5) * 1000);
        
        // Generate trend values from existing data or compute
        const engagement = acc.engagement || 0.5;
        const smart = acc.smart || 0.5;
        const early = acc.early || 0.5;
        
        // Velocity: how fast is the account growing (based on engagement + smart)
        const velocity = (engagement - 0.5) * 1.5 + (smart - 0.5) * 0.5;
        // Acceleration: rate of change (based on early signal potential)
        const acceleration = (early - 0.5) * 1.2 + (engagement - 0.5) * 0.3;
        
        // Trend state
        const state = velocity > 0.2 ? 'growing' : velocity < -0.2 ? 'cooling' : Math.abs(acceleration) > 0.3 ? 'volatile' : 'stable';
        
        // Compute adjusted influence
        const trendBoost = 0.35 * velocity + 0.15 * acceleration;
        const influenceAdjusted = Math.round(Math.min(1000, Math.max(0, influenceBase * (1 + trendBoost))));
        
        // Risk level based on confidence
        const confidence = acc.confidence || 0.5;
        const riskLevel = confidence > 0.7 ? 'low' : confidence > 0.4 ? 'medium' : 'high';
        
        // Compute early signal
        const earlySignal = computeEarlySignal({
          influence_base: influenceBase,
          influence_adjusted: influenceAdjusted,
          trend: {
            velocity_norm: Math.max(-1, Math.min(1, velocity)),
            acceleration_norm: Math.max(-1, Math.min(1, acceleration)),
          },
          signal_noise: 5,
          risk_level: riskLevel,
          profile: profile as 'retail' | 'influencer' | 'whale',
        });
        
        return {
          author_id: acc.author_id || acc.id || acc._id?.toString(),
          username: acc.handle?.replace('@', '') || acc.title,
          name: acc.title,
          avatar: acc.avatar,
          followers: followers,
          profile,
          risk_level: riskLevel,
          influence_base: influenceBase,
          influence_adjusted: influenceAdjusted,
          influence_score: influenceBase,
          x_score: acc.twitterScore || Math.round(engagement * 600),
          trend: {
            velocity_norm: Math.max(-1, Math.min(1, velocity)),
            acceleration_norm: Math.max(-1, Math.min(1, acceleration)),
            state,
          },
          early_signal: {
            score: earlySignal.early_signal_score,
            badge: earlySignal.badge,
            confidence: earlySignal.confidence,
          },
          signal_noise: 5,
          categories: acc.categories || [],
          source: acc.source,
        };
      });
      
      // Count signals
      const breakouts = radarAccounts.filter(a => a.early_signal.badge === 'breakout').length;
      const rising = radarAccounts.filter(a => a.early_signal.badge === 'rising').length;
      
      return reply.send({
        ok: true,
        data: {
          accounts: radarAccounts,
          total: radarAccounts.length,
          stats: {
            breakouts,
            rising,
            total: radarAccounts.length,
          },
        },
      });
    } catch (error: any) {
      console.error('[Radar] Error fetching accounts:', error);
      return reply.status(500).send({
        ok: false,
        error: 'RADAR_ERROR',
        message: error.message,
      });
    }
  });

  // ============================================================
  // THRESHOLD TUNING MATRIX API v1
  // ============================================================

  /**
   * POST /api/connections/tuning
   * 
   * Run threshold tuning analysis for a specific parameter.
   */
  app.post('/tuning', async (req: FastifyRequest, reply: FastifyReply) => {
    const { runThresholdTuning, generateMockTuningDataset } = await import('../core/scoring/threshold-tuning.js');
    
    const body = req.body as {
      parameter: string;
      deltas?: number[];
      dataset?: any[];
    };
    
    if (!body.parameter) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'parameter required (e.g., trend.k_velocity)',
      });
    }

    try {
      const dataset = body.dataset || generateMockTuningDataset(20);
      const deltas = body.deltas || [-0.2, -0.1, 0, 0.1, 0.2];
      
      const result = runThresholdTuning(
        dataset,
        body.parameter as any,
        deltas
      );
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TUNING_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/tuning/mock
   * 
   * Returns mock tuning analysis for demo purposes.
   */
  app.get('/tuning/mock', async (req: FastifyRequest, reply: FastifyReply) => {
    const { runThresholdTuning, generateMockTuningDataset } = await import('../core/scoring/threshold-tuning.js');
    
    const query = req.query as { parameter?: string };
    const parameter = (query.parameter || 'trend.k_velocity') as any;
    
    try {
      const dataset = generateMockTuningDataset(15);
      const deltas = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15];
      
      const result = runThresholdTuning(dataset, parameter, deltas);
      
      return reply.send({
        ok: true,
        message: `Mock tuning for ${parameter}`,
        dataset_size: dataset.length,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TUNING_MOCK_ERROR',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/connections/tuning/full
   * 
   * Run full tuning matrix for all key parameters.
   */
  app.get('/tuning/full', async (_req: FastifyRequest, reply: FastifyReply) => {
    const { runFullTuningMatrix, generateMockTuningDataset } = await import('../core/scoring/threshold-tuning.js');
    
    try {
      const dataset = generateMockTuningDataset(20);
      const result = runFullTuningMatrix(dataset);
      
      return reply.send({
        ok: true,
        message: 'Full tuning matrix analysis',
        dataset_size: dataset.length,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TUNING_FULL_ERROR',
        message: error.message,
      });
    }
  });

  // ============================================================
  // CONNECTIONS GRAPH API
  // ============================================================
  
  // Register graph routes (new full implementation)
  const { graphRoutes } = await import('./graph.routes.js');
  await app.register(graphRoutes);

  // ============================================================
  // TWITTER SCORE API v1.0 (Phase 1.1)
  // ============================================================
  
  // Register Twitter Score routes
  const { twitterScoreRoutes } = await import('./twitter-score.routes.js');
  await app.register(twitterScoreRoutes);

  // ============================================================
  // AUDIENCE QUALITY API v1.0 (Phase 1.2)
  // ============================================================
  
  // Register Audience Quality routes
  const { audienceQualityRoutes } = await import('./audience-quality.routes.js');
  await app.register(audienceQualityRoutes);

  // Register Audience Quality Admin routes
  const { audienceQualityAdminRoutes } = await import('../admin/audience-quality-admin.routes.js');
  await app.register(audienceQualityAdminRoutes);

  // ============================================================
  // HOPS / SOCIAL DISTANCE API v1.0 (Phase 1.3)
  // ============================================================
  
  // Register Hops routes
  const { hopsRoutes } = await import('./hops.routes.js');
  await app.register(hopsRoutes);

  // Register Hops Admin routes
  const { hopsAdminRoutes } = await import('../admin/hops-admin.routes.js');
  await app.register(hopsAdminRoutes);

  // ============================================================
  // AUTHORITY ENGINE API v1.0 (Phase 3.1)
  // ============================================================
  
  // Register Authority routes
  const { registerAuthorityRoutes } = await import('./authority.routes.js');
  await app.register(registerAuthorityRoutes, { prefix: '/authority' });

  // Register Authority Admin routes
  const { registerAuthorityAdminRoutes } = await import('../admin/authority-admin.routes.js');
  await app.register(registerAuthorityAdminRoutes, { prefix: '/admin/authority' });

  // ============================================================
  // SMART FOLLOWERS API v1.0 (Phase 3.2)
  // ============================================================
  
  // Register Smart Followers routes
  const { registerSmartFollowersRoutes } = await import('./smart-followers.routes.js');
  await app.register(registerSmartFollowersRoutes, { prefix: '/smart-followers' });

  // Register Smart Followers Admin routes
  const { registerSmartFollowersAdminRoutes } = await import('../admin/smart-followers-admin.routes.js');
  await app.register(registerSmartFollowersAdminRoutes, { prefix: '/admin/smart-followers' });

  // ============================================================
  // NETWORK PATHS API v1.0 (Phase 3.4)
  // ============================================================
  
  // Register Paths routes
  const { registerPathsRoutes } = await import('./paths.routes.js');
  await app.register(registerPathsRoutes, { prefix: '/paths' });

  // Register Paths Admin routes
  const { registerPathsAdminRoutes } = await import('../admin/paths-admin.routes.js');
  await app.register(registerPathsAdminRoutes, { prefix: '/admin/paths' });

  // Register Network Health Admin routes (Phase 3.4.5)
  const { registerNetworkHealthRoutes } = await import('../admin/network-health.routes.js');
  await app.register(registerNetworkHealthRoutes, { prefix: '/admin' });

  // Register Twitter Adapter Admin routes (Phase 4.1)
  const { registerTwitterAdapterRoutes } = await import('../adapters/twitter/api/twitter-adapter.routes.js');
  await app.register(registerTwitterAdapterRoutes, { prefix: '/admin/twitter-adapter' });

  // Register Twitter Confidence routes (Phase 4.1.6)
  const { registerTwitterConfidenceRoutes, registerTwitterConfidenceAdminRoutes } = await import('../twitter-confidence/index.js');
  await app.register(registerTwitterConfidenceRoutes, { prefix: '/twitter-confidence' });
  await app.register(registerTwitterConfidenceAdminRoutes, { prefix: '/admin/twitter-confidence' });

  console.log('[Connections] API routes registered at /api/connections');
  console.log('[Connections] Graph API registered at /api/connections/graph');
  console.log('[Connections] Twitter Score API registered at /api/connections/twitter-score');
  console.log('[Connections] Audience Quality API registered at /api/connections/audience-quality');
  console.log('[Connections] Hops API registered at /api/connections/hops');
  console.log('[Connections] Authority API registered at /api/connections/authority');
  console.log('[Connections] Smart Followers API registered at /api/connections/smart-followers');
  console.log('[Connections] Paths API registered at /api/connections/paths');
  console.log('[Connections] Twitter Adapter Admin API registered at /api/connections/admin/twitter-adapter');
  console.log('[Connections] Twitter Confidence API registered at /api/connections/twitter-confidence');
  
  // Phase 3.5: Register AI routes
  try {
    const { getMongoDb } = await import('../../../db/mongoose.js');
    const db = getMongoDb();
    const aiService = new AiSummaryService(db);
    await aiService.init();
    setAiService(aiService);
    setAiServiceForAdmin(aiService);
    await app.register(registerAiRoutes, { prefix: '/ai' });
    await app.register(registerAiAdminRoutes, { prefix: '/admin/ai' });
    console.log('[Connections] AI Summary API registered at /api/connections/ai');
  } catch (err) {
    console.error('[Connections] AI routes registration failed:', err);
  }

  // Phase 4.4: Register Graph Overlay routes
  try {
    const { registerGraphOverlayRoutes, registerGraphOverlayAdminRoutes } = await import('../core/graph/graph-overlay.routes.js');
    await app.register(registerGraphOverlayRoutes, { prefix: '/graph' });
    await app.register(registerGraphOverlayAdminRoutes, { prefix: '/admin/graph/overlay' });
    console.log('[Connections] Graph Overlay API registered at /api/connections/graph/overlay');
  } catch (err) {
    console.error('[Connections] Graph Overlay routes registration failed:', err);
  }

  // Follow Graph Job API routes
  try {
    const { 
      refreshFollowGraph, 
      getFollowGraphJobStatus 
    } = await import('../../../jobs/follow_graph.job.js');
    
    // GET /api/connections/follow-graph/status - Get job status
    app.get('/follow-graph/status', async () => {
      return { ok: true, ...getFollowGraphJobStatus() };
    });
    
    // POST /api/connections/follow-graph/refresh - Trigger manual refresh
    app.post('/follow-graph/refresh', async (request: any) => {
      const { limit = 5, minFollowers = 10000 } = request.body || {};
      const result = await refreshFollowGraph({ limit, minFollowers });
      return { ok: true, ...result };
    });
    
    console.log('[Connections] Follow Graph Job API registered at /api/connections/follow-graph/*');
  } catch (err) {
    console.error('[Connections] Follow Graph routes registration failed:', err);
  }
}
