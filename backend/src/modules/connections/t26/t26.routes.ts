/**
 * T2.6 Routes - Real Accounts Expansion
 * 
 * Admin API for managing transition to real accounts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getT26Config,
  activateT26,
  addRealAccount,
  getAccounts,
  getAccountStats,
  validateAccount,
  type AccountSource,
  type AccountType,
} from './real-accounts.store.js';
import { isMicroFreezeActive, getFreezeStatus } from '../freeze/micro-freeze.guard.js';

export function registerT26Routes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/t26';
  
  // ============================================================
  // GET /api/admin/connections/t26/status
  // T2.6 status overview
  // ============================================================
  app.get(`${PREFIX}/status`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getT26Config();
      const accountStats = await getAccountStats();
      const freezeActive = await isMicroFreezeActive();
      
      return reply.send({
        ok: true,
        data: {
          version: config.version,
          status: config.status,
          activated_at: config.activated_at,
          
          // Micro-Freeze dependency
          micro_freeze_active: freezeActive,
          micro_freeze_required: true,
          
          // Accounts
          accounts: {
            max: config.max_real_accounts,
            current: config.current_real_accounts,
            ...accountStats,
          },
          
          // Monitoring
          monitoring: config.monitoring,
          
          // Alert constraints
          alerts: config.alerts,
          
          // Validation gates
          validation: config.validation,
        },
      });
    } catch (err: any) {
      console.error('[T2.6] Status error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /api/admin/connections/t26/activate
  // Activate T2.6 (requires Micro-Freeze to be active)
  // ============================================================
  app.post(`${PREFIX}/activate`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check Micro-Freeze prerequisite
      const freezeActive = await isMicroFreezeActive();
      
      if (!freezeActive) {
        return reply.code(400).send({
          ok: false,
          error: 'PREREQUISITE_FAILED',
          message: 'Micro-Freeze (T2.5) must be ACTIVE before activating T2.6',
          action: 'POST /api/admin/connections/freeze/activate',
        });
      }
      
      const config = await activateT26();
      
      return reply.send({
        ok: true,
        message: '🚀 T2.6 ACTIVATED - Pilot → Real Accounts mode enabled',
        data: {
          status: config.status,
          activated_at: config.activated_at,
          constraints: {
            network_weight: '20% (locked)',
            confidence_gate: `${config.alerts.confidence_gate * 100}%`,
            ml2_mode: 'SHADOW (observation only)',
            drift_blocking: true,
          },
        },
      });
    } catch (err: any) {
      console.error('[T2.6] Activate error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /api/admin/connections/t26/accounts
  // Add real account
  // ============================================================
  app.post(`${PREFIX}/accounts`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        twitter_id: string;
        handle: string;
        source?: AccountSource;
        type?: AccountType;
        is_pilot?: boolean;
      };
      
      if (!body.twitter_id || !body.handle) {
        return reply.code(400).send({
          ok: false,
          error: 'twitter_id and handle are required',
        });
      }
      
      const account = await addRealAccount({
        twitter_id: body.twitter_id,
        handle: body.handle.replace('@', ''),
        source: body.source || 'REAL',
        type: body.type || 'SMART_NO_NAME',
        added_by: 'ADMIN',
        is_pilot: body.is_pilot ?? false,
        is_active: true,
        validation_status: 'PENDING',
      });
      
      return reply.send({
        ok: true,
        message: `Account @${account.handle} added`,
        data: account,
      });
    } catch (err: any) {
      console.error('[T2.6] Add account error:', err);
      
      if (err.code === 11000) {
        return reply.code(400).send({
          ok: false,
          error: 'DUPLICATE',
          message: 'Account already exists',
        });
      }
      
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /api/admin/connections/t26/accounts
  // List accounts
  // ============================================================
  app.get(`${PREFIX}/accounts`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        source?: AccountSource;
        type?: AccountType;
        active_only?: string;
        limit?: string;
      };
      
      const accounts = await getAccounts({
        source: query.source,
        type: query.type,
        active_only: query.active_only === 'true',
        limit: parseInt(query.limit || '100'),
      });
      
      const stats = await getAccountStats();
      
      return reply.send({
        ok: true,
        data: {
          accounts,
          stats,
        },
      });
    } catch (err: any) {
      console.error('[T2.6] List accounts error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /api/admin/connections/t26/accounts/:twitter_id/validate
  // Validate/reject account
  // ============================================================
  app.post(`${PREFIX}/accounts/:twitter_id/validate`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { twitter_id: string };
      const body = request.body as {
        status: 'VALIDATED' | 'REJECTED';
        notes?: string;
      };
      
      if (!['VALIDATED', 'REJECTED'].includes(body.status)) {
        return reply.code(400).send({
          ok: false,
          error: 'status must be VALIDATED or REJECTED',
        });
      }
      
      await validateAccount(params.twitter_id, body.status, body.notes);
      
      return reply.send({
        ok: true,
        message: `Account ${params.twitter_id} ${body.status}`,
      });
    } catch (err: any) {
      console.error('[T2.6] Validate account error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /api/admin/connections/t26/validation-criteria
  // Check T2.6 validation criteria
  // ============================================================
  app.get(`${PREFIX}/validation-criteria`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getT26Config();
      const freezeStatus = await getFreezeStatus();
      
      // Criteria for T2.6 success
      const criteria = {
        micro_freeze_active: {
          required: true,
          current: freezeStatus.active,
          passed: freezeStatus.active,
        },
        fp_rate: {
          required: '≤15%',
          current: `${(config.monitoring.fp_rate_current * 100).toFixed(1)}%`,
          passed: config.monitoring.fp_rate_current <= 0.15,
        },
        drift_level: {
          required: 'NOT HIGH',
          current: config.monitoring.drift_level,
          passed: config.monitoring.drift_level !== 'HIGH',
        },
        smart_no_name_in_alerts: {
          required: true,
          current: config.monitoring.smart_no_name_in_alerts,
          passed: config.monitoring.smart_no_name_in_alerts,
        },
        noise_rate: {
          required: '<20%',
          current: `${(config.monitoring.noise_rate * 100).toFixed(1)}%`,
          passed: config.monitoring.noise_rate < 0.20,
        },
      };
      
      const allPassed = Object.values(criteria).every(c => c.passed);
      
      return reply.send({
        ok: true,
        data: {
          overall_status: allPassed ? 'PASSED' : 'IN_PROGRESS',
          ready_for_production_freeze: allPassed,
          criteria,
          next_step: allPassed 
            ? 'Ready for Production Freeze v1' 
            : 'Continue monitoring and validation',
        },
      });
    } catch (err: any) {
      console.error('[T2.6] Validation criteria error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[T2.6] Routes registered at ${PREFIX}/*`);
}
