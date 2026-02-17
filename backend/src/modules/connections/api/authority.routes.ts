/**
 * Authority API Routes
 * 
 * Prefix: /api/connections/authority
 * 
 * Endpoints:
 * - GET /:account_id - Get authority score for an account
 * - POST /batch - Get authority scores for multiple accounts
 * - GET /mock - Get mock authority score
 * - GET /top - Get top authority accounts
 * - GET /stats - Get authority statistics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  computeAuthority, 
  computeAuthorityForNode, 
  getTopAuthorities,
  explainAuthority,
  getAuthorityTier,
  authorityConfig,
  AuthorityGraphSnapshot,
} from '../core/authority/index.js';
import { graphSnapshotStore } from '../share/graph-state.store.js';

// Cache for authority results (TTL-based)
let authorityCache: {
  result: ReturnType<typeof computeAuthority> | null;
  timestamp: number;
} = { result: null, timestamp: 0 };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get or compute authority scores with caching
 */
async function getAuthorityScores(): Promise<ReturnType<typeof computeAuthority> | null> {
  const now = Date.now();
  
  // Return cached if fresh
  if (authorityCache.result && (now - authorityCache.timestamp) < CACHE_TTL_MS) {
    return authorityCache.result;
  }
  
  // Get latest graph snapshot
  const snapshot = graphSnapshotStore.getLatest();
  if (!snapshot || !snapshot.nodes.length) {
    return null;
  }
  
  // Convert to authority format
  const authoritySnapshot: AuthorityGraphSnapshot = {
    nodes: snapshot.nodes.map(n => ({
      id: n.id,
      twitter_score: n.score,
      influence_score: n.influence_score,
    })),
    edges: snapshot.edges.map(e => ({
      source: e.source,
      target: e.target,
      strength_0_1: e.strength,
      jaccard: e.jaccard,
      shared: e.shared,
    })),
  };
  
  // Compute authority
  const result = computeAuthority(authoritySnapshot);
  
  // Update cache
  authorityCache = { result, timestamp: now };
  
  return result;
}

/**
 * Generate mock authority data for demo
 */
function generateMockAuthority(accountId: string): {
  account_id: string;
  authority_score_0_1: number;
  rank: number;
  percentile: number;
  tier: ReturnType<typeof getAuthorityTier>;
  explain: ReturnType<typeof explainAuthority>;
} {
  // Deterministic mock based on account_id hash
  const hash = accountId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const score = 0.2 + (hash % 70) / 100; // 0.2 - 0.9
  const tier = getAuthorityTier(score);
  const explain = explainAuthority(score);
  
  return {
    account_id: accountId,
    authority_score_0_1: Number(score.toFixed(4)),
    rank: Math.floor(1 + (1 - score) * 50),
    percentile: Number((score * 100).toFixed(1)),
    tier,
    explain,
  };
}

export async function registerAuthorityRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/connections/authority/mock
   * Get mock authority score for UI development
   */
  app.get('/mock', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { account_id?: string };
    const accountId = query.account_id || 'mock_authority_001';
    
    const mock = generateMockAuthority(accountId);
    
    return reply.send({
      ok: true,
      message: 'Mock authority score for UI development',
      data: mock,
    });
  });
  
  /**
   * GET /api/connections/authority/:account_id
   * Get authority score for a specific account
   */
  app.get('/:account_id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!authorityConfig.enabled) {
      return reply.status(503).send({
        ok: false,
        error: 'AUTHORITY_DISABLED',
        message: 'Authority engine is disabled',
      });
    }
    
    const { account_id } = req.params as { account_id: string };
    
    try {
      const result = await getAuthorityScores();
      
      if (!result) {
        // Fall back to mock if no graph data
        const mock = generateMockAuthority(account_id);
        return reply.send({
          ok: true,
          source: 'mock',
          data: mock,
        });
      }
      
      const score = result.scores_0_1[account_id];
      
      if (score === undefined) {
        return reply.status(404).send({
          ok: false,
          error: 'NOT_FOUND',
          message: `Account ${account_id} not found in authority graph`,
        });
      }
      
      // Calculate rank and percentile
      const allScores = Object.values(result.scores_0_1);
      const sortedScores = [...allScores].sort((a, b) => b - a);
      const rank = sortedScores.indexOf(score) + 1;
      const percentile = (1 - (rank / sortedScores.length)) * 100;
      
      const tier = getAuthorityTier(score);
      const explain = explainAuthority(score);
      
      return reply.send({
        ok: true,
        source: 'computed',
        data: {
          account_id,
          authority_score_0_1: Number(score.toFixed(4)),
          rank,
          percentile: Number(percentile.toFixed(1)),
          tier,
          explain,
          stats: result.stats,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'COMPUTATION_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * POST /api/connections/authority/batch
   * Get authority scores for multiple accounts
   */
  app.post('/batch', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!authorityConfig.enabled) {
      return reply.status(503).send({
        ok: false,
        error: 'AUTHORITY_DISABLED',
        message: 'Authority engine is disabled',
      });
    }
    
    const body = req.body as { account_ids: string[] };
    
    if (!body.account_ids || !Array.isArray(body.account_ids)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'account_ids array required',
      });
    }
    
    try {
      const result = await getAuthorityScores();
      
      const scores: Record<string, {
        authority_score_0_1: number;
        rank: number;
        tier: ReturnType<typeof getAuthorityTier>;
      }> = {};
      
      const allScores = result ? Object.values(result.scores_0_1) : [];
      const sortedScores = [...allScores].sort((a, b) => b - a);
      
      for (const accountId of body.account_ids) {
        const score = result?.scores_0_1[accountId];
        
        if (score !== undefined) {
          const rank = sortedScores.indexOf(score) + 1;
          scores[accountId] = {
            authority_score_0_1: Number(score.toFixed(4)),
            rank,
            tier: getAuthorityTier(score),
          };
        } else {
          // Mock for missing accounts
          const mock = generateMockAuthority(accountId);
          scores[accountId] = {
            authority_score_0_1: mock.authority_score_0_1,
            rank: mock.rank,
            tier: mock.tier,
          };
        }
      }
      
      return reply.send({
        ok: true,
        data: {
          scores,
          total_requested: body.account_ids.length,
          found_in_graph: Object.keys(scores).filter(id => result?.scores_0_1[id] !== undefined).length,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'BATCH_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/authority/top
   * Get top authority accounts
   */
  app.get('/top', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    
    try {
      const result = await getAuthorityScores();
      
      if (!result) {
        // Return mock top accounts
        const mockTop = Array.from({ length: limit }, (_, i) => ({
          id: `top_account_${i + 1}`,
          score: Number((0.95 - i * 0.03).toFixed(4)),
          rank: i + 1,
          tier: getAuthorityTier(0.95 - i * 0.03),
        }));
        
        return reply.send({
          ok: true,
          source: 'mock',
          data: {
            top: mockTop,
            total_accounts: limit,
          },
        });
      }
      
      const top = getTopAuthorities(result, limit).map(item => ({
        ...item,
        tier: getAuthorityTier(item.score),
      }));
      
      return reply.send({
        ok: true,
        source: 'computed',
        data: {
          top,
          total_accounts: result.stats.nodes,
          stats: result.stats,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TOP_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/authority/stats
   * Get authority engine statistics
   */
  app.get('/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await getAuthorityScores();
      
      if (!result) {
        return reply.send({
          ok: true,
          source: 'no_data',
          data: {
            message: 'No graph data available for authority computation',
            config: {
              enabled: authorityConfig.enabled,
              damping: authorityConfig.damping,
              iterations: authorityConfig.iterations,
            },
          },
        });
      }
      
      // Calculate distribution stats
      const scores = Object.values(result.scores_0_1);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const sorted = [...scores].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      
      // Tier distribution
      const tierDist: Record<string, number> = {
        elite: 0, high: 0, 'upper-mid': 0, mid: 0, 'low-mid': 0, low: 0,
      };
      for (const s of scores) {
        const tier = getAuthorityTier(s).tier;
        tierDist[tier]++;
      }
      
      return reply.send({
        ok: true,
        source: 'computed',
        data: {
          stats: result.stats,
          distribution: {
            average: Number(avg.toFixed(4)),
            median: Number(median.toFixed(4)),
            min: Number(sorted[0].toFixed(4)),
            max: Number(sorted[sorted.length - 1].toFixed(4)),
          },
          tier_distribution: tierDist,
          config: {
            enabled: authorityConfig.enabled,
            damping: authorityConfig.damping,
            iterations: authorityConfig.iterations,
            network_mix: authorityConfig.twitter_score_network_mix,
          },
          cache: {
            age_ms: Date.now() - authorityCache.timestamp,
            ttl_ms: CACHE_TTL_MS,
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
  
  /**
   * POST /api/connections/authority/invalidate-cache
   * Force cache invalidation (admin use)
   */
  app.post('/invalidate-cache', async (_req: FastifyRequest, reply: FastifyReply) => {
    authorityCache = { result: null, timestamp: 0 };
    
    return reply.send({
      ok: true,
      message: 'Authority cache invalidated',
    });
  });
  
  /**
   * POST /api/connections/authority/seed-graph
   * Generate mock graph for authority testing
   */
  app.post('/seed-graph', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { node_count?: number };
    const nodeCount = Math.min(body.node_count || 30, 100);
    
    const snapshot = graphSnapshotStore.generateMockSnapshot(nodeCount);
    
    // Clear authority cache to force recompute
    authorityCache = { result: null, timestamp: 0 };
    
    return reply.send({
      ok: true,
      message: `Generated mock graph with ${nodeCount} nodes`,
      data: {
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length,
        timestamp: snapshot.timestamp,
      },
    });
  });
  
  console.log('[Authority] Routes registered: /api/connections/authority/*');
}
