/**
 * Twitter Score API Routes
 * 
 * Endpoints for unified Twitter Score computation.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { computeTwitterScore, computeTwitterScoreBatch } from "../core/twitter-score/twitter-score.engine.js";
import { getTwitterScoreConfig, updateTwitterScoreConfig, TWITTER_SCORE_VERSION } from "../core/twitter-score/twitter-score.config.js";
import type { TwitterScoreInput } from "../contracts/twitter-score.contracts.js";

interface ComputeBody {
  account_id: string;
  base_influence?: number;
  x_score?: number;
  signal_noise?: number;
  risk_level?: "LOW" | "MED" | "HIGH";
  red_flags?: string[];
  velocity?: number;
  acceleration?: number;
  early_signal_badge?: "none" | "rising" | "breakout";
  early_signal_score?: number;
}

interface BatchBody {
  accounts: ComputeBody[];
}

export async function twitterScoreRoutes(app: FastifyInstance) {
  // ==========================================
  // GET /api/connections/twitter-score/info
  // ==========================================
  app.get('/twitter-score/info', async () => {
    const config = getTwitterScoreConfig();
    return {
      ok: true,
      data: {
        version: TWITTER_SCORE_VERSION,
        weights: config.weights,
        grades: config.grades,
        penalties: {
          risk_levels: Object.keys(config.penalties.risk_level),
          red_flags: Object.keys(config.penalties.red_flags),
          max_penalty: config.penalties.max_total_penalty,
        },
        components: [
          { name: "influence", weight: config.weights.influence, description: "Base influence from engagement/reach" },
          { name: "quality", weight: config.weights.quality, description: "Profile quality (x_score + signal/noise)" },
          { name: "trend", weight: config.weights.trend, description: "Growth dynamics (velocity + acceleration)" },
          { name: "network_proxy", weight: config.weights.network_proxy, description: "Network signal (proxy until follower data)" },
          { name: "consistency", weight: config.weights.consistency, description: "Stability (proxy until timeseries)" },
        ],
      },
    };
  });

  // ==========================================
  // POST /api/connections/twitter-score
  // ==========================================
  app.post('/twitter-score', async (
    req: FastifyRequest<{ Body: ComputeBody }>,
    reply: FastifyReply
  ) => {
    try {
      const input = req.body;
      
      if (!input?.account_id) {
        reply.code(400);
        return { ok: false, error: "account_id is required" };
      }

      const result = computeTwitterScore(input as TwitterScoreInput);
      
      return {
        ok: true,
        data: result,
      };
    } catch (err: any) {
      console.error('[TwitterScore] Compute error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // POST /api/connections/twitter-score/batch
  // ==========================================
  app.post('/twitter-score/batch', async (
    req: FastifyRequest<{ Body: BatchBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { accounts } = req.body || {};
      
      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
        reply.code(400);
        return { ok: false, error: "accounts array is required" };
      }

      if (accounts.length > 100) {
        reply.code(400);
        return { ok: false, error: "Maximum 100 accounts per batch" };
      }

      const result = computeTwitterScoreBatch(accounts as TwitterScoreInput[]);
      
      return {
        ok: true,
        data: result,
      };
    } catch (err: any) {
      console.error('[TwitterScore] Batch error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // GET /api/connections/twitter-score/mock
  // ==========================================
  app.get('/twitter-score/mock', async () => {
    const samples: TwitterScoreInput[] = [
      {
        account_id: "crypto_whale_001",
        base_influence: 930,
        x_score: 820,
        signal_noise: 8.5,
        velocity: 18,
        acceleration: 6,
        risk_level: "LOW",
        red_flags: [],
        early_signal_badge: "rising",
        early_signal_score: 72,
      },
      {
        account_id: "hidden_alpha_002",
        base_influence: 520,
        x_score: 760,
        signal_noise: 7.2,
        velocity: 22,
        acceleration: 10,
        risk_level: "LOW",
        red_flags: [],
        early_signal_badge: "breakout",
        early_signal_score: 88,
      },
      {
        account_id: "farm_account_003",
        base_influence: 680,
        x_score: 410,
        signal_noise: 3.0,
        velocity: 5,
        acceleration: -3,
        risk_level: "HIGH",
        red_flags: ["REPOST_FARM", "BOT_LIKE_PATTERN"],
        early_signal_badge: "none",
        early_signal_score: 12,
      },
      {
        account_id: "stable_influencer_004",
        base_influence: 750,
        x_score: 680,
        signal_noise: 6.5,
        velocity: 8,
        acceleration: 2,
        risk_level: "LOW",
        red_flags: [],
        early_signal_badge: "none",
        early_signal_score: 35,
      },
      {
        account_id: "new_rising_star_005",
        base_influence: 320,
        x_score: 550,
        signal_noise: 7.0,
        velocity: 35,
        acceleration: 15,
        risk_level: "MED",
        red_flags: ["VIRAL_SPIKE"],
        early_signal_badge: "breakout",
        early_signal_score: 92,
      },
    ];

    const results = samples.map(computeTwitterScore);

    return {
      ok: true,
      data: {
        version: TWITTER_SCORE_VERSION,
        description: "Mock Twitter Score results for testing",
        results,
        grade_distribution: {
          S: results.filter(r => r.grade === 'S').length,
          A: results.filter(r => r.grade === 'A').length,
          B: results.filter(r => r.grade === 'B').length,
          C: results.filter(r => r.grade === 'C').length,
          D: results.filter(r => r.grade === 'D').length,
        },
      },
    };
  });

  // ==========================================
  // GET /api/connections/twitter-score/config
  // ==========================================
  app.get('/twitter-score/config', async () => {
    return {
      ok: true,
      data: getTwitterScoreConfig(),
    };
  });

  // ==========================================
  // PUT /api/connections/twitter-score/config
  // ==========================================
  app.put('/twitter-score/config', async (
    req: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ) => {
    try {
      const updates = req.body;
      updateTwitterScoreConfig(updates);
      
      return {
        ok: true,
        message: "Config updated",
        data: getTwitterScoreConfig(),
      };
    } catch (err: any) {
      console.error('[TwitterScore] Config update error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  console.log('[TwitterScore] Routes registered: /api/connections/twitter-score/*');
}
