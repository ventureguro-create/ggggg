/**
 * Hops Admin Routes
 * 
 * Admin endpoints for tuning hops configuration.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { 
  getHopsConfig, 
  updateHopsConfig,
  HOPS_VERSION 
} from "../core/hops/hops.config.js";

interface PatchBody {
  defaults?: {
    max_hops?: 1 | 2 | 3;
    top_n?: number;
    score_field?: "twitter_score" | "influence_score" | "trend_adjusted";
    edge_min_strength?: number;
  };
  scoring?: {
    hop_weight?: Record<number, number>;
    strength_weight?: number;
  };
  confidence?: {
    min_nodes_for_high?: number;
    min_edges_for_high?: number;
    min_nodes_for_med?: number;
    min_edges_for_med?: number;
  };
}

export async function hopsAdminRoutes(app: FastifyInstance) {
  // ==========================================
  // GET /api/admin/connections/hops/config
  // ==========================================
  app.get('/admin/connections/hops/config', async () => {
    return {
      ok: true,
      data: {
        enabled: true,
        version: HOPS_VERSION,
        config: getHopsConfig(),
      },
    };
  });

  // ==========================================
  // PATCH /api/admin/connections/hops/config
  // ==========================================
  app.patch('/admin/connections/hops/config', async (
    req: FastifyRequest<{ Body: PatchBody }>,
    reply: FastifyReply
  ) => {
    try {
      const patch = req.body ?? {};

      // Validate max_hops if provided
      if (patch.defaults?.max_hops && ![1, 2, 3].includes(patch.defaults.max_hops)) {
        reply.code(400);
        return { ok: false, error: "max_hops must be 1, 2, or 3" };
      }

      // Validate edge_min_strength if provided
      if (patch.defaults?.edge_min_strength !== undefined) {
        if (patch.defaults.edge_min_strength < 0 || patch.defaults.edge_min_strength > 1) {
          reply.code(400);
          return { ok: false, error: "edge_min_strength must be between 0 and 1" };
        }
      }

      // Validate strength_weight if provided
      if (patch.scoring?.strength_weight !== undefined) {
        if (patch.scoring.strength_weight < 0 || patch.scoring.strength_weight > 1) {
          reply.code(400);
          return { ok: false, error: "strength_weight must be between 0 and 1" };
        }
      }

      updateHopsConfig(patch);

      return {
        ok: true,
        message: "Configuration updated",
        data: {
          version: HOPS_VERSION,
          config: getHopsConfig(),
        },
      };
    } catch (err: any) {
      console.error('[Hops Admin] Config update error:', err);
      reply.code(400);
      return { ok: false, error: err.message };
    }
  });

  // ==========================================
  // GET /api/admin/connections/hops/scoring
  // ==========================================
  app.get('/admin/connections/hops/scoring', async () => {
    const config = getHopsConfig();
    return {
      ok: true,
      data: {
        hop_weights: config.scoring.hop_weight,
        strength_weight: config.scoring.strength_weight,
        description: {
          hop_weight: "Weight applied based on number of hops (closer = higher)",
          strength_weight: "How much path strength (bottleneck) contributes to score",
        },
      },
    };
  });

  console.log('[Hops Admin] Routes registered: /api/admin/connections/hops/*');
}
