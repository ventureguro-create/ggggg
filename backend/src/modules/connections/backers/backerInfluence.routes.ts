/**
 * Backer Influence Routes - E5 Phase
 * 
 * API endpoints for Backer Influence Network.
 * READ-ONLY, no writes (FREEZE v2 compliant).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as BackerInfluenceService from './backerInfluence.service.js';
import * as BackerStore from './backer.store.js';
import type { InfluenceGraphFilters } from './backerInfluence.types.js';

export function registerBackerInfluenceRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/connections/backers';
  
  // ============================================================
  // E5.1 — INFLUENCE GRAPH
  // ============================================================
  
  /**
   * GET /backers/:slug/influence-graph
   * Get influence network graph for a backer
   */
  app.get(`${PREFIX}/:slug/influence-graph`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      const query = request.query as InfluenceGraphFilters;
      
      // Get backer by slug first
      const backer = await BackerStore.getBackerBySlug(slug);
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      const graph = await BackerInfluenceService.getBackerInfluenceGraph(backer.id, {
        depth: query.depth,
        includeProjects: query.includeProjects !== false,
        includeAccounts: query.includeAccounts !== false,
        includeCoInvestors: query.includeCoInvestors !== false,
      });
      
      if (!graph) {
        return reply.code(404).send({ ok: false, error: 'GRAPH_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        data: graph,
      });
    } catch (err: any) {
      console.error('[BackerInfluenceRoutes] Error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // E5.2 — INFLUENCE SUMMARY
  // ============================================================
  
  /**
   * GET /backers/:slug/influence-summary
   * Get influence summary for a backer
   */
  app.get(`${PREFIX}/:slug/influence-summary`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      
      const backer = await BackerStore.getBackerBySlug(slug);
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      const summary = await BackerInfluenceService.getBackerInfluenceSummary(backer.id);
      
      if (!summary) {
        return reply.code(404).send({ ok: false, error: 'SUMMARY_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        data: summary,
      });
    } catch (err: any) {
      console.error('[BackerInfluenceRoutes] Error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // E5.3 — PROJECT IMPACT TABLE
  // ============================================================
  
  /**
   * GET /backers/:slug/project-impact
   * Get project impact table for a backer
   */
  app.get(`${PREFIX}/:slug/project-impact`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      
      const backer = await BackerStore.getBackerBySlug(slug);
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      const impact = await BackerInfluenceService.getBackerProjectImpact(backer.id);
      
      if (!impact) {
        return reply.code(404).send({ ok: false, error: 'IMPACT_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        data: impact,
      });
    } catch (err: any) {
      console.error('[BackerInfluenceRoutes] Error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // E5.4 — COMBINED (Full Detail)
  // ============================================================
  
  /**
   * GET /backers/:slug/influence
   * Get complete influence data (graph + summary + impact)
   */
  app.get(`${PREFIX}/:slug/influence`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      
      const backer = await BackerStore.getBackerBySlug(slug);
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      // Fetch all data in parallel
      const [graph, summary, impact] = await Promise.all([
        BackerInfluenceService.getBackerInfluenceGraph(backer.id),
        BackerInfluenceService.getBackerInfluenceSummary(backer.id),
        BackerInfluenceService.getBackerProjectImpact(backer.id),
      ]);
      
      return reply.send({
        ok: true,
        data: {
          backer: {
            id: backer.id,
            slug: backer.slug,
            name: backer.name,
            type: backer.type,
            seedAuthority: backer.seedAuthority,
            categories: backer.categories,
          },
          graph: graph ? {
            nodes: graph.nodes,
            edges: graph.edges,
            stats: graph.stats,
          } : null,
          summary,
          projectImpact: impact,
        },
      });
    } catch (err: any) {
      console.error('[BackerInfluenceRoutes] Error:', err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[BackerInfluence] Routes registered at ${PREFIX}/:slug/influence* (E5 Phase)`);
}
