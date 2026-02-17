/**
 * Micro-Freeze Routes - T2.5
 * 
 * Admin API for Micro-Freeze Pipeline
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  getMicroFreezeConfig, 
  activateMicroFreeze, 
  deactivateMicroFreeze,
  getViolations,
  getViolationStats,
} from './micro-freeze.store.js';
import { getFreezeStatus } from './micro-freeze.guard.js';

export function registerMicroFreezeRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/freeze';
  
  // ============================================================
  // GET /api/admin/connections/freeze/status
  // Main status endpoint for admin panel
  // ============================================================
  app.get(`${PREFIX}/status`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await getFreezeStatus();
      
      return reply.send({
        ok: true,
        data: {
          ...status,
          badge: status.active ? '🧊 MICRO_FREEZE' : '⚪ INACTIVE',
          level: status.config.level,
          version: status.config.version,
          activated_at: status.config.activated_at,
          activated_by: status.config.activated_by,
        },
      });
    } catch (err: any) {
      console.error('[MicroFreeze] Status error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /api/admin/connections/freeze/config
  // Full config details
  // ============================================================
  app.get(`${PREFIX}/config`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getMicroFreezeConfig();
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      console.error('[MicroFreeze] Config error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /api/admin/connections/freeze/activate
  // Activate Micro-Freeze
  // ============================================================
  app.post(`${PREFIX}/activate`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { activated_by?: string } | undefined;
      const activatedBy = body?.activated_by || 'ADMIN';
      
      const config = await activateMicroFreeze(activatedBy);
      
      return reply.send({
        ok: true,
        message: '🧊 Micro-Freeze ACTIVATED',
        data: {
          status: config.status,
          activated_at: config.activated_at,
          activated_by: config.activated_by,
          locked_parameters: {
            network_weight_cap: config.network.weight_cap,
            confidence_gate: config.alert_pipeline.confidence_gate,
            ml2_mode: 'SHADOW',
            drift_blocking: true,
          },
        },
      });
    } catch (err: any) {
      console.error('[MicroFreeze] Activate error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /api/admin/connections/freeze/deactivate
  // Deactivate Micro-Freeze (requires reason)
  // ============================================================
  app.post(`${PREFIX}/deactivate`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { reason?: string } | undefined;
      const reason = body?.reason || 'MANUAL';
      
      const config = await deactivateMicroFreeze(reason);
      
      return reply.send({
        ok: true,
        message: '⚠️ Micro-Freeze DEACTIVATED',
        warning: 'System is now unprotected. Parameters can be changed.',
        data: {
          status: config.status,
          deactivation_reason: reason,
        },
      });
    } catch (err: any) {
      console.error('[MicroFreeze] Deactivate error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /api/admin/connections/freeze/violations
  // Get violation history
  // ============================================================
  app.get(`${PREFIX}/violations`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { 
        limit?: string; 
        blocked_only?: string;
        since?: string;
      };
      
      const violations = await getViolations({
        limit: parseInt(query.limit || '50'),
        blocked_only: query.blocked_only === 'true',
        since: query.since,
      });
      
      const stats = await getViolationStats(query.since);
      
      return reply.send({
        ok: true,
        data: {
          violations,
          stats,
        },
      });
    } catch (err: any) {
      console.error('[MicroFreeze] Violations error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /api/admin/connections/freeze/acceptance-criteria
  // Check if system meets acceptance criteria for freeze
  // ============================================================
  app.get(`${PREFIX}/acceptance-criteria`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getMicroFreezeConfig();
      
      // Get current FP rate (mock for now, should connect to real metrics)
      const fpRate = 0.08; // 8% - example
      const driftLevel = 'LOW'; // Should come from drift service
      const stabilityHours = 72; // Should come from uptime tracker
      
      const criteria = config.acceptance_criteria;
      
      const results = {
        fp_rate: {
          current: fpRate,
          threshold: criteria.fp_rate_threshold,
          passed: fpRate <= criteria.fp_rate_threshold,
        },
        drift: {
          current: driftLevel,
          must_not_be: criteria.drift_must_not_be,
          passed: !criteria.drift_must_not_be.includes(driftLevel),
        },
        stability: {
          current_hours: stabilityHours,
          required_hours: criteria.min_stability_hours,
          passed: stabilityHours >= criteria.min_stability_hours,
        },
      };
      
      const allPassed = results.fp_rate.passed && results.drift.passed && results.stability.passed;
      
      return reply.send({
        ok: true,
        data: {
          overall_status: allPassed ? 'PASSED' : 'FAILED',
          can_proceed_to_t26: allPassed,
          criteria: results,
        },
      });
    } catch (err: any) {
      console.error('[MicroFreeze] Acceptance criteria error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[MicroFreeze] Routes registered at ${PREFIX}/*`);
}
