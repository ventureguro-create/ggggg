/**
 * Audience Quality Admin Routes
 * 
 * Admin endpoints for tuning audience quality configuration.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { 
  getAudienceQualityConfig, 
  updateAudienceQualityConfig,
  AUDIENCE_QUALITY_VERSION 
} from "../core/audience-quality/audience-quality.config.js";

interface PatchBody {
  weights?: {
    purity?: number;
    smart_followers_proxy?: number;
    signal_quality?: number;
    consistency?: number;
  };
  overlap?: {
    jaccard_soft?: number;
    jaccard_hard?: number;
    shared_soft?: number;
    shared_hard?: number;
  };
  botRisk?: {
    red_flags?: Record<string, number>;
  };
  neutral?: {
    tier1_share_0_1?: number;
    top_followers_count?: number;
  };
  confidence?: {
    min_overlap_samples_for_high?: number;
    min_overlap_samples_for_med?: number;
  };
}

export async function audienceQualityAdminRoutes(app: FastifyInstance) {
  // ==========================================
  // GET /api/admin/connections/audience-quality/config
  // ==========================================
  app.get('/admin/connections/audience-quality/config', async () => {
    return {
      ok: true,
      data: {
        version: AUDIENCE_QUALITY_VERSION,
        config: getAudienceQualityConfig(),
      },
    };
  });

  // ==========================================
  // PATCH /api/admin/connections/audience-quality/config
  // ==========================================
  app.patch('/admin/connections/audience-quality/config', async (
    req: FastifyRequest<{ Body: PatchBody }>,
    reply: FastifyReply
  ) => {
    try {
      const patch = req.body ?? {};

      // Validate weights sum if provided
      if (patch.weights) {
        const config = getAudienceQualityConfig();
        const newWeights = { ...config.weights, ...patch.weights };
        const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
        
        if (Math.abs(sum - 1.0) > 0.01) {
          reply.code(400);
          return { 
            ok: false, 
            error: `Weights must sum to 1.0 (current sum: ${sum.toFixed(3)})` 
          };
        }
      }

      updateAudienceQualityConfig(patch);

      return {
        ok: true,
        message: "Configuration updated",
        data: {
          version: AUDIENCE_QUALITY_VERSION,
          config: getAudienceQualityConfig(),
        },
      };
    } catch (err: any) {
      console.error('[AudienceQuality Admin] Config update error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // GET /api/admin/connections/audience-quality/red-flags
  // ==========================================
  app.get('/admin/connections/audience-quality/red-flags', async () => {
    const config = getAudienceQualityConfig();
    return {
      ok: true,
      data: {
        red_flags: config.botRisk.red_flags,
        max_from_flags: config.botRisk.max_from_flags,
      },
    };
  });

  // ==========================================
  // PUT /api/admin/connections/audience-quality/red-flags
  // ==========================================
  app.put('/admin/connections/audience-quality/red-flags', async (
    req: FastifyRequest<{ Body: { red_flags: Record<string, number> } }>,
    reply: FastifyReply
  ) => {
    try {
      const { red_flags } = req.body ?? {};
      
      if (!red_flags || typeof red_flags !== 'object') {
        reply.code(400);
        return { ok: false, error: "red_flags object is required" };
      }

      updateAudienceQualityConfig({ botRisk: { red_flags } });

      return {
        ok: true,
        message: "Red flags updated",
        data: getAudienceQualityConfig().botRisk,
      };
    } catch (err: any) {
      console.error('[AudienceQuality Admin] Red flags update error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  console.log('[AudienceQuality Admin] Routes registered: /api/admin/connections/audience-quality/*');
}
