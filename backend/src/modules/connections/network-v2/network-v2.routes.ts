/**
 * Network v2 - Routes
 * 
 * Admin API for Network v2 management and monitoring
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getNetworkV2Config,
  setNetworkV2Status,
  updateNetworkV2Config,
  getNetworkV2Stats,
  getTopProfiles,
  getSmartNoNames,
  getNetworkV2Profile,
  buildNetworkV2Profile,
  processBatch,
} from './authority-engine.js';
import { addFollowRelationship, findSocialPath, getGraphStats } from './follow-graph.reader.js';
import { isProductionFreezeActive } from '../freeze/production-freeze.store.js';
import { isMicroFreezeActive, checkDriftGuard } from '../freeze/micro-freeze.guard.js';

export function registerNetworkV2Routes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/network-v2';
  
  // ============================================================
  // GET /status - Network v2 full status
  // ============================================================
  app.get(`${PREFIX}/status`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getNetworkV2Stats();
      const productionFrozen = await isProductionFreezeActive();
      const microFrozen = await isMicroFreezeActive();
      
      return reply.send({
        ok: true,
        data: {
          version: stats.config.version,
          status: stats.config.status,
          
          // Safety checks
          safety: {
            production_freeze_active: productionFrozen,
            micro_freeze_active: microFrozen,
            drift_blocks_v2: stats.config.drift_blocks_v2,
            max_v2_weight: stats.config.max_v2_weight,
            confidence_gate: stats.config.confidence_gate,
          },
          
          // Current blend
          blend: stats.config.v1_v2_blend,
          
          // Statistics
          stats: {
            profiles_count: stats.profiles_count,
            by_tier: stats.by_tier,
            smart_no_names: stats.smart_no_names,
            accounts_processed: stats.config.accounts_processed,
            last_updated: stats.config.last_updated,
          },
          
          // Graph stats
          graph: stats.graph_stats,
          
          // Weights
          weights: stats.config.weights,
          
          // Badge
          badge: stats.config.status === 'ACTIVE'
            ? '🌐 NETWORK v2 ACTIVE'
            : stats.config.status === 'SHADOW'
              ? '👁️ NETWORK v2 SHADOW'
              : '⚪ NETWORK v2 DISABLED',
        },
      });
    } catch (err: any) {
      console.error('[NetworkV2] Status error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /enable-shadow - Enable Shadow mode (safe, no impact)
  // ============================================================
  app.post(`${PREFIX}/enable-shadow`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check prerequisites
      const productionFrozen = await isProductionFreezeActive();
      
      if (!productionFrozen) {
        return reply.code(400).send({
          ok: false,
          error: 'PREREQUISITE_FAILED',
          message: 'Production Freeze must be ACTIVE before enabling Network v2',
        });
      }
      
      const config = await setNetworkV2Status('SHADOW');
      
      return reply.send({
        ok: true,
        message: '👁️ Network v2 SHADOW mode enabled',
        data: {
          status: config.status,
          impact: 'NONE - observation only',
          v2_weight: 0,
          what_happens: [
            '✅ Network v2 profiles calculated',
            '✅ Authority scores computed',
            '✅ Elite exposure tracked',
            '❌ No impact on Twitter Score',
            '❌ No impact on alerts',
          ],
        },
      });
    } catch (err: any) {
      console.error('[NetworkV2] Enable shadow error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /activate - Activate Network v2 (with blend)
  // ============================================================
  app.post(`${PREFIX}/activate`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { v2_weight?: number } | undefined;
      const requestedWeight = body?.v2_weight ?? 0.10; // Start at 10%
      
      // Check prerequisites
      const productionFrozen = await isProductionFreezeActive();
      const config = await getNetworkV2Config();
      
      if (!productionFrozen) {
        return reply.code(400).send({
          ok: false,
          error: 'PREREQUISITE_FAILED',
          message: 'Production Freeze must be ACTIVE',
        });
      }
      
      // Check weight cap
      if (requestedWeight > config.max_v2_weight) {
        return reply.code(400).send({
          ok: false,
          error: 'WEIGHT_CAP_EXCEEDED',
          message: `v2_weight cannot exceed ${config.max_v2_weight * 100}%`,
          max_allowed: config.max_v2_weight,
        });
      }
      
      // Check drift
      const driftCheck = await checkDriftGuard('LOW'); // Would use actual drift level
      if (driftCheck.expansion_blocked) {
        return reply.code(400).send({
          ok: false,
          error: 'DRIFT_BLOCKED',
          message: 'High drift level blocks Network v2 activation',
        });
      }
      
      // Update config
      const updatedConfig = await updateNetworkV2Config({
        status: 'ACTIVE',
        v1_v2_blend: {
          v1_weight: 1 - requestedWeight,
          v2_weight: requestedWeight,
        },
      });
      
      return reply.send({
        ok: true,
        message: '🌐 Network v2 ACTIVATED',
        data: {
          status: updatedConfig.status,
          blend: updatedConfig.v1_v2_blend,
          what_happens: [
            `✅ Network v2 contributes ${requestedWeight * 100}% to final score`,
            `✅ Follow Authority active`,
            `✅ Social Distance active`,
            `✅ Elite Exposure active`,
            `⚠️ Drift auto-rollback enabled`,
          ],
        },
      });
    } catch (err: any) {
      console.error('[NetworkV2] Activate error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /disable - Disable Network v2
  // ============================================================
  app.post(`${PREFIX}/disable`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await setNetworkV2Status('DISABLED');
      
      // Reset blend
      await updateNetworkV2Config({
        v1_v2_blend: { v1_weight: 1, v2_weight: 0 },
      });
      
      return reply.send({
        ok: true,
        message: 'Network v2 DISABLED',
        data: { status: config.status },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /profiles/top - Get top profiles by influence
  // ============================================================
  app.get(`${PREFIX}/profiles/top`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string };
      const profiles = await getTopProfiles(parseInt(query.limit || '20'));
      
      return reply.send({
        ok: true,
        data: {
          count: profiles.length,
          profiles: profiles.map(p => ({
            handle: p.handle,
            authority_tier: p.authority.tier,
            authority_score: p.authority.score,
            network_influence: p.network_influence,
            elite_exposure: p.elite_exposure.elite_percentage,
            confidence: p.confidence,
          })),
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /profiles/smart-no-names - Get hidden gems
  // ============================================================
  app.get(`${PREFIX}/profiles/smart-no-names`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string };
      const profiles = await getSmartNoNames(parseInt(query.limit || '20'));
      
      return reply.send({
        ok: true,
        data: {
          count: profiles.length,
          description: 'High-quality accounts with low visibility (hidden gems)',
          profiles: profiles.map(p => ({
            handle: p.handle,
            smart_no_name_score: p.smart_no_name_score,
            authority_tier: p.authority.tier,
            elite_exposure: p.elite_exposure.elite_percentage,
            total_followers: p.inbound_connections,
            network_trust: p.network_trust,
          })),
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /profiles/:account_id - Get specific profile
  // ============================================================
  app.get(`${PREFIX}/profiles/:account_id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { account_id: string };
      const profile = await getNetworkV2Profile(params.account_id);
      
      if (!profile) {
        return reply.code(404).send({
          ok: false,
          error: 'NOT_FOUND',
          message: 'Profile not found',
        });
      }
      
      return reply.send({ ok: true, data: profile });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /profiles/:account_id/build - Build/rebuild profile
  // ============================================================
  app.post(`${PREFIX}/profiles/:account_id/build`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { account_id: string };
      const body = request.body as { handle: string };
      
      if (!body.handle) {
        return reply.code(400).send({ ok: false, error: 'handle required' });
      }
      
      const profile = await buildNetworkV2Profile(params.account_id, body.handle);
      
      return reply.send({
        ok: true,
        message: `Profile built for @${body.handle}`,
        data: profile,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /graph/path - Find social path between accounts
  // ============================================================
  app.get(`${PREFIX}/graph/path`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { from: string; to: string };
      
      if (!query.from || !query.to) {
        return reply.code(400).send({ ok: false, error: 'from and to required' });
      }
      
      const path = await findSocialPath(query.from, query.to);
      
      if (!path) {
        return reply.send({
          ok: true,
          data: {
            found: false,
            message: 'No path found within 3 hops',
          },
        });
      }
      
      return reply.send({
        ok: true,
        data: {
          found: true,
          path,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /graph/follow - Add follow relationship
  // ============================================================
  app.post(`${PREFIX}/graph/follow`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        follower_id: string;
        following_id: string;
      };
      
      if (!body.follower_id || !body.following_id) {
        return reply.code(400).send({ ok: false, error: 'follower_id and following_id required' });
      }
      
      await addFollowRelationship(body.follower_id, body.following_id);
      
      return reply.send({
        ok: true,
        message: 'Follow relationship added',
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /graph/stats - Get graph statistics
  // ============================================================
  app.get(`${PREFIX}/graph/stats`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getGraphStats();
      
      return reply.send({
        ok: true,
        data: stats,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /config/blend - Update v1/v2 blend
  // ============================================================
  app.post(`${PREFIX}/config/blend`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { v2_weight: number };
      
      if (typeof body.v2_weight !== 'number' || body.v2_weight < 0 || body.v2_weight > 1) {
        return reply.code(400).send({ ok: false, error: 'v2_weight must be 0-1' });
      }
      
      const config = await getNetworkV2Config();
      
      // Check cap
      if (body.v2_weight > config.max_v2_weight) {
        return reply.code(400).send({
          ok: false,
          error: 'WEIGHT_CAP_EXCEEDED',
          message: `Cannot exceed ${config.max_v2_weight * 100}%`,
        });
      }
      
      const updated = await updateNetworkV2Config({
        v1_v2_blend: {
          v1_weight: 1 - body.v2_weight,
          v2_weight: body.v2_weight,
        },
      });
      
      return reply.send({
        ok: true,
        message: 'Blend updated',
        data: updated.v1_v2_blend,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[NetworkV2] Routes registered at ${PREFIX}/*`);
}
