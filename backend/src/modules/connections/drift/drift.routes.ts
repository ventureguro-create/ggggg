/**
 * Drift v1 API Routes
 * Phase 6.0 — Environment Observation Layer
 * 
 * READ-ONLY endpoints — no modifications to system
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildDriftReport, getDriftStatus, canExpandLive } from './drift.report.service.js';
import { getBaseline } from './drift.baseline.service.js';

export async function registerDriftRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============================================================
  // DRIFT REPORT (Main endpoint)
  // ============================================================
  
  /**
   * GET /api/connections/drift/report
   * Full drift report with all dimensions
   */
  fastify.get('/report', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const report = buildDriftReport();
      return reply.send({
        ok: true,
        data: report,
      });
    } catch (err: any) {
      console.error('[Drift] Report error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  // ============================================================
  // QUICK STATUS
  // ============================================================
  
  /**
   * GET /api/connections/drift/status
   * Quick status check (for headers/badges)
   */
  fastify.get('/status', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = getDriftStatus();
      return reply.send({
        ok: true,
        data: status,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  // ============================================================
  // BASELINE INFO
  // ============================================================
  
  /**
   * GET /api/connections/drift/baseline
   * Current baseline snapshot info
   */
  fastify.get('/baseline', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const baseline = getBaseline();
      return reply.send({
        ok: true,
        data: {
          id: baseline.id,
          name: baseline.name,
          created_at: baseline.created_at,
          metrics_summary: {
            data_metrics: Object.keys(baseline.data_metrics).length,
            network_metrics: Object.keys(baseline.network_metrics).length,
            concept_metrics: Object.keys(baseline.concept_metrics).length,
          },
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/drift/baseline/full
   * Full baseline snapshot with all metrics
   */
  fastify.get('/baseline/full', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const baseline = getBaseline();
      return reply.send({
        ok: true,
        data: baseline,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  // ============================================================
  // EXPANSION GATE
  // ============================================================
  
  /**
   * GET /api/connections/drift/can-expand
   * Check if live expansion is allowed
   */
  fastify.get('/can-expand', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = canExpandLive();
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  // ============================================================
  // INDIVIDUAL SECTIONS
  // ============================================================
  
  /**
   * GET /api/connections/drift/data
   * Data drift section only
   */
  fastify.get('/data', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const report = buildDriftReport();
      return reply.send({
        ok: true,
        data: {
          level: report.data.level,
          metrics: report.data.metrics,
          issues: report.data.issues,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/drift/network
   * Network drift section only
   */
  fastify.get('/network', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const report = buildDriftReport();
      return reply.send({
        ok: true,
        data: {
          level: report.network.level,
          metrics: report.network.metrics,
          issues: report.network.issues,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/drift/concept
   * Concept drift section only
   */
  fastify.get('/concept', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const report = buildDriftReport();
      return reply.send({
        ok: true,
        data: {
          level: report.concept.level,
          metrics: report.concept.metrics,
          issues: report.concept.issues,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[Drift] Routes registered at /api/connections/drift/*');
}
