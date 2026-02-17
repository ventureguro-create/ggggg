/**
 * Silent Authority Routes - Network v2
 * 
 * Admin API for Silent Authority detection and alerts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getSilentAuthorityConfig,
  updateSilentAuthorityConfig,
  testDetection,
  batchDetection,
  getRecentAlerts,
  getAlertStats,
  recordAlert,
} from './silent-authority.service.js';
import type { SilentAuthorityInput } from './silent-authority.detector.js';

export function registerSilentAuthorityRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/network-v2/silent-authority';
  
  // ============================================================
  // GET /config - Get config
  // ============================================================
  app.get(`${PREFIX}/config`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getSilentAuthorityConfig();
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // PATCH /config - Update config
  // ============================================================
  app.patch(`${PREFIX}/config`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Partial<any>;
      const config = await updateSilentAuthorityConfig(body);
      return reply.send({ ok: true, data: config });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /test - Test detection on single account
  // ============================================================
  app.post(`${PREFIX}/test`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as SilentAuthorityInput;
      
      if (!input.account_id || !input.handle) {
        return reply.code(400).send({
          ok: false,
          error: 'account_id and handle required',
          example: {
            account_id: '123456',
            handle: 'example_user',
            authority_score: 0.85,
            authority_tier: 'HIGH',
            tweets_30d: 3,
            engagement_30d: 150,
            inbound_elite_count: 5,
            followers_count: 2500,
            followers_growth_30d: 2.5,
            confidence: 0.8,
          },
        });
      }
      
      const result = await testDetection(input);
      
      return reply.send({
        ok: true,
        data: result,
        interpretation: result.flag !== 'NONE'
          ? `🔔 ${result.flag}: @${result.handle} is a silent authority with score ${Math.round(result.score * 100)}%`
          : `❌ Not a silent authority. Missing criteria: ${result.reasons.length === 0 ? 'none met' : 'some met'}`,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /batch - Batch detection
  // ============================================================
  app.post(`${PREFIX}/batch`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { inputs: SilentAuthorityInput[] };
      
      if (!body.inputs || !Array.isArray(body.inputs)) {
        return reply.code(400).send({ ok: false, error: 'inputs array required' });
      }
      
      const results = await batchDetection(body.inputs);
      
      return reply.send({
        ok: true,
        data: {
          detected_count: results.length,
          results,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /alerts - Get recent alerts
  // ============================================================
  app.get(`${PREFIX}/alerts`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string; flag?: string };
      
      const alerts = await getRecentAlerts({
        limit: parseInt(query.limit || '50'),
        flag: query.flag,
      });
      
      return reply.send({
        ok: true,
        data: {
          count: alerts.length,
          alerts,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /alerts/stats - Get alert statistics
  // ============================================================
  app.get(`${PREFIX}/alerts/stats`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getAlertStats();
      return reply.send({ ok: true, data: stats });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /alerts/record - Manually record an alert
  // ============================================================
  app.post(`${PREFIX}/alerts/record`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as SilentAuthorityInput;
      
      // First detect
      const result = await testDetection(input);
      
      if (result.flag === 'NONE') {
        return reply.send({
          ok: false,
          error: 'Not a silent authority',
          data: result,
        });
      }
      
      // Try to record
      const recordResult = await recordAlert(result);
      
      return reply.send({
        ok: recordResult.recorded,
        message: recordResult.recorded 
          ? `Alert recorded for @${result.handle}`
          : `Alert not recorded: ${recordResult.reason}`,
        data: result,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[SilentAuthority] Routes registered at ${PREFIX}/*`);
}
