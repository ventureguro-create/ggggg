/**
 * Hops API Routes
 * 
 * Endpoints for social distance / handshakes calculation.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { computeHops, computeHopsBatch } from "../core/hops/hops.engine.js";
import { getHopsConfig, HOPS_VERSION } from "../core/hops/hops.config.js";
import type { HopsInput } from "../contracts/hops.contracts.js";

interface ComputeBody extends HopsInput {}

interface BatchBody {
  items: HopsInput[];
}

// Mock graph for testing
function getMockGraph() {
  return {
    nodes: [
      { id: "whale_alpha", twitter_score: 920, influence_score: 850 },
      { id: "influencer_001", twitter_score: 780, influence_score: 720 },
      { id: "rising_star", twitter_score: 680, influence_score: 640 },
      { id: "retail_user_a", twitter_score: 420, influence_score: 380 },
      { id: "retail_user_b", twitter_score: 380, influence_score: 350 },
      { id: "hidden_gem", twitter_score: 520, influence_score: 580 },
      { id: "connector_001", twitter_score: 550, influence_score: 490 },
      { id: "connector_002", twitter_score: 480, influence_score: 440 },
      { id: "outlier_001", twitter_score: 320, influence_score: 280 },
      { id: "test_account", twitter_score: 450, influence_score: 400 },
    ],
    edges: [
      // Direct connections to top nodes
      { source: "whale_alpha", target: "influencer_001", strength_0_1: 0.85 },
      { source: "whale_alpha", target: "rising_star", strength_0_1: 0.72 },
      { source: "influencer_001", target: "rising_star", strength_0_1: 0.68 },
      
      // Connector paths
      { source: "connector_001", target: "whale_alpha", strength_0_1: 0.55 },
      { source: "connector_001", target: "hidden_gem", strength_0_1: 0.62 },
      { source: "connector_002", target: "influencer_001", strength_0_1: 0.48 },
      { source: "connector_002", target: "connector_001", strength_0_1: 0.58 },
      
      // Retail user paths
      { source: "retail_user_a", target: "connector_001", strength_0_1: 0.45 },
      { source: "retail_user_a", target: "retail_user_b", strength_0_1: 0.52 },
      { source: "retail_user_b", target: "connector_002", strength_0_1: 0.42 },
      
      // Hidden gem connections
      { source: "hidden_gem", target: "rising_star", strength_0_1: 0.58 },
      { source: "hidden_gem", target: "test_account", strength_0_1: 0.65 },
      
      // Test account paths
      { source: "test_account", target: "connector_001", strength_0_1: 0.50 },
      { source: "test_account", target: "retail_user_a", strength_0_1: 0.38 },
      
      // Outlier (weakly connected)
      { source: "outlier_001", target: "retail_user_b", strength_0_1: 0.32 },
    ],
  };
}

export async function hopsRoutes(app: FastifyInstance) {
  // ==========================================
  // GET /api/connections/hops/info
  // ==========================================
  app.get('/hops/info', async () => {
    const config = getHopsConfig();
    return {
      ok: true,
      data: {
        version: HOPS_VERSION,
        defaults: config.defaults,
        scoring: config.scoring,
        confidence: config.confidence,
        description: "Computes shortest paths (1-3 hops) to top nodes and authority proximity score.",
      },
    };
  });

  // ==========================================
  // POST /api/connections/hops
  // ==========================================
  app.post('/hops', async (
    req: FastifyRequest<{ Body: ComputeBody }>,
    reply: FastifyReply
  ) => {
    try {
      const input = req.body;
      
      if (!input?.account_id) {
        reply.code(400);
        return { ok: false, error: "account_id is required" };
      }

      // Validate max_hops if provided
      if (input.max_hops && ![1, 2, 3].includes(input.max_hops)) {
        reply.code(400);
        return { ok: false, error: "max_hops must be 1, 2, or 3" };
      }

      // Use mock graph for now (will be replaced with real graph builder)
      const snapshot = getMockGraph();
      
      const result = computeHops(input, snapshot);
      
      return {
        ok: true,
        data: result,
      };
    } catch (err: any) {
      console.error('[Hops] Compute error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // POST /api/connections/hops/batch
  // ==========================================
  app.post('/hops/batch', async (
    req: FastifyRequest<{ Body: BatchBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { items } = req.body || {};
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        reply.code(400);
        return { ok: false, error: "items array is required" };
      }

      if (items.length > 50) {
        reply.code(400);
        return { ok: false, error: "Maximum 50 items per batch" };
      }

      // Validate each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item?.account_id) {
          reply.code(400);
          return { ok: false, error: `Item ${i}: account_id is required` };
        }
        
        if (item.max_hops && ![1, 2, 3].includes(item.max_hops)) {
          reply.code(400);
          return { ok: false, error: `Item ${i}: max_hops must be 1, 2, or 3` };
        }
      }

      const snapshot = getMockGraph();
      const result = computeHopsBatch(items, snapshot);
      
      return {
        ok: true,
        data: result,
      };
    } catch (err: any) {
      console.error('[Hops] Batch error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // GET /api/connections/hops/mock
  // ==========================================
  app.get('/hops/mock', async () => {
    const mockGraph = getMockGraph();

    const examples = [
      // Test account: 2 hops to whale
      computeHops({ 
        account_id: "test_account", 
        max_hops: 3, 
        top_nodes: { mode: "top_n", top_n: 3, score_field: "twitter_score" } 
      }, mockGraph),
      
      // Retail user: needs 3 hops
      computeHops({ 
        account_id: "retail_user_a", 
        max_hops: 3, 
        top_nodes: { mode: "top_n", top_n: 3, score_field: "twitter_score" } 
      }, mockGraph),
      
      // Connector: direct paths
      computeHops({ 
        account_id: "connector_001", 
        max_hops: 2, 
        top_nodes: { mode: "explicit", explicit_ids: ["whale_alpha", "influencer_001"] } 
      }, mockGraph),
      
      // Outlier: weakly connected
      computeHops({ 
        account_id: "outlier_001", 
        max_hops: 3, 
        top_nodes: { mode: "top_n", top_n: 3, score_field: "twitter_score" } 
      }, mockGraph),
    ];

    return {
      ok: true,
      data: {
        version: HOPS_VERSION,
        description: "Mock Hops results demonstrating different network positions",
        graph_info: {
          nodes: mockGraph.nodes.length,
          edges: mockGraph.edges.length,
        },
        examples,
      },
    };
  });

  // ==========================================
  // GET /api/connections/hops/config
  // ==========================================
  app.get('/hops/config', async () => {
    return {
      ok: true,
      data: getHopsConfig(),
    };
  });

  console.log('[Hops] Routes registered: /api/connections/hops/*');
}
