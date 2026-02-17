/**
 * Audience Quality API Routes
 * 
 * Endpoints for audience quality assessment.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { computeAudienceQuality, computeAudienceQualityBatch } from "../core/audience-quality/audience-quality.engine.js";
import { getAudienceQualityConfig, AUDIENCE_QUALITY_VERSION } from "../core/audience-quality/audience-quality.config.js";
import type { AudienceQualityInput } from "../contracts/audience-quality.contracts.js";

interface ComputeBody extends AudienceQualityInput {}

interface BatchBody {
  items: AudienceQualityInput[];
}

export async function audienceQualityRoutes(app: FastifyInstance) {
  // ==========================================
  // GET /api/connections/audience-quality/info
  // ==========================================
  app.get('/audience-quality/info', async () => {
    const config = getAudienceQualityConfig();
    return {
      ok: true,
      data: {
        version: AUDIENCE_QUALITY_VERSION,
        weights: config.weights,
        overlap_thresholds: config.overlap,
        quality_thresholds: config.quality_thresholds,
        confidence_requirements: config.confidence,
        components: [
          { name: "purity", weight: config.weights.purity, description: "Audience cleanliness (low overlap + low bot risk)" },
          { name: "smart_followers_proxy", weight: config.weights.smart_followers_proxy, description: "Smart followers signal (proxy until Twitter data)" },
          { name: "signal_quality", weight: config.weights.signal_quality, description: "Signal quality from x_score + signal/noise" },
          { name: "consistency", weight: config.weights.consistency, description: "Behavioral consistency" },
        ],
        red_flags_tracked: Object.keys(config.botRisk.red_flags),
      },
    };
  });

  // ==========================================
  // POST /api/connections/audience-quality
  // ==========================================
  app.post('/audience-quality', async (
    req: FastifyRequest<{ Body: ComputeBody }>,
    reply: FastifyReply
  ) => {
    try {
      const input = req.body;
      
      if (!input?.account_id) {
        reply.code(400);
        return { ok: false, error: "account_id is required" };
      }

      const result = computeAudienceQuality(input);
      
      return {
        ok: true,
        data: result,
      };
    } catch (err: any) {
      console.error('[AudienceQuality] Compute error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // POST /api/connections/audience-quality/batch
  // ==========================================
  app.post('/audience-quality/batch', async (
    req: FastifyRequest<{ Body: BatchBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { items } = req.body || {};
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        reply.code(400);
        return { ok: false, error: "items array is required" };
      }

      if (items.length > 100) {
        reply.code(400);
        return { ok: false, error: "Maximum 100 items per batch" };
      }

      const result = computeAudienceQualityBatch(items);
      
      return {
        ok: true,
        data: result,
      };
    } catch (err: any) {
      console.error('[AudienceQuality] Batch error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // GET /api/connections/audience-quality/mock
  // ==========================================
  app.get('/audience-quality/mock', async () => {
    const samples: AudienceQualityInput[] = [
      {
        account_id: "clean_influencer",
        x_score: 820,
        signal_noise: 8.2,
        consistency_0_1: 0.70,
        red_flags: [],
        overlap: { 
          avg_jaccard: 0.05, 
          max_jaccard: 0.12, 
          avg_shared: 12, 
          max_shared: 35, 
          sample_size: 12 
        },
      },
      {
        account_id: "mixed_profile",
        x_score: 650,
        signal_noise: 6.0,
        consistency_0_1: 0.55,
        red_flags: ["VIRAL_SPIKE"],
        overlap: { 
          avg_jaccard: 0.08, 
          max_jaccard: 0.18, 
          avg_shared: 22, 
          max_shared: 60, 
          sample_size: 6 
        },
      },
      {
        account_id: "overlap_farm",
        x_score: 420,
        signal_noise: 3.4,
        consistency_0_1: 0.45,
        red_flags: ["AUDIENCE_OVERLAP", "REPOST_FARM", "BOT_LIKE_PATTERN"],
        overlap: { 
          avg_jaccard: 0.15, 
          max_jaccard: 0.33, 
          avg_shared: 55, 
          max_shared: 130, 
          sample_size: 10 
        },
      },
      {
        account_id: "unknown_data",
        x_score: 540,
        signal_noise: 5.5,
        // no overlap, no flags
      },
      {
        account_id: "rising_star",
        x_score: 720,
        signal_noise: 7.5,
        consistency_0_1: 0.65,
        red_flags: [],
        early_signal_badge: "rising",
        overlap: { 
          avg_jaccard: 0.06, 
          max_jaccard: 0.14, 
          avg_shared: 18, 
          max_shared: 42, 
          sample_size: 9 
        },
      },
    ];

    const results = samples.map(computeAudienceQuality);

    return {
      ok: true,
      data: {
        version: AUDIENCE_QUALITY_VERSION,
        description: "Mock Audience Quality results for testing",
        results,
        quality_distribution: {
          high: results.filter(r => r.audience_quality_score_0_1 >= 0.70).length,
          medium: results.filter(r => r.audience_quality_score_0_1 >= 0.50 && r.audience_quality_score_0_1 < 0.70).length,
          low: results.filter(r => r.audience_quality_score_0_1 < 0.50).length,
        },
      },
    };
  });

  // ==========================================
  // GET /api/connections/audience-quality/config
  // ==========================================
  app.get('/audience-quality/config', async () => {
    return {
      ok: true,
      data: getAudienceQualityConfig(),
    };
  });

  console.log('[AudienceQuality] Routes registered: /api/connections/audience-quality/*');
}
