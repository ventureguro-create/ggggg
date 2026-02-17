/**
 * Graph Overlay Routes (Phase 4.4)
 * 
 * API endpoints for graph overlay:
 * - GET /api/connections/graph/overlay
 * - GET /api/connections/graph/overlay/explain
 * - GET /api/admin/connections/graph/overlay/config
 * - PATCH /api/admin/connections/graph/overlay/config
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildConnectionsGraph } from './build-graph.js';
import { buildGraphOverlay, getEdgeOverlayExplain } from './graph-overlay.builder.js';
import { getGraphOverlayConfig, patchGraphOverlayConfig } from './graph-overlay.config.js';
import { GraphQuerySchema } from '../../contracts/graph.contracts.js';
import type { GraphOverlayMode } from '../../contracts/graph-overlay.contracts.js';

export async function registerGraphOverlayRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /overlay
   * Get graph with overlay metadata
   */
  fastify.get('/overlay', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      
      // Parse graph params
      const parsed = GraphQuerySchema.safeParse({
        seed: query.seed,
        depth: query.depth,
        limit: query.limit,
        min_jaccard: query.min_jaccard,
        min_shared: query.min_shared,
        max_degree: query.max_degree,
      });
      
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: 'Invalid query parameters',
        });
      }
      
      // Get overlay mode from query or config
      const cfg = await getGraphOverlayConfig();
      const mode = (query.mode as GraphOverlayMode) || cfg.mode;
      
      // Build base graph
      const baseGraph = await buildConnectionsGraph(parsed.data);
      
      // Build overlay
      const overlay = await buildGraphOverlay(baseGraph, { mode });
      
      return reply.send({
        ok: true,
        ...overlay,
      });
      
    } catch (err: any) {
      console.error('[GraphOverlay] Error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /overlay/explain
   * Get explanation for specific edge
   */
  fastify.get('/overlay/explain', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { edge_id?: string };
      
      if (!query.edge_id) {
        return reply.status(400).send({
          ok: false,
          error: 'edge_id query parameter required',
        });
      }
      
      const explain = await getEdgeOverlayExplain(query.edge_id);
      return reply.send(explain);
      
    } catch (err: any) {
      console.error('[GraphOverlay] Explain error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[GraphOverlay] Routes registered at /api/connections/graph/overlay/*');
}

/**
 * Admin routes for overlay config
 */
export async function registerGraphOverlayAdminRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /config
   * Get overlay config
   */
  fastify.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getGraphOverlayConfig();
      return reply.send({
        ok: true,
        data: config,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * PATCH /config
   * Update overlay config
   */
  fastify.patch('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const updates = request.body as any;
      const config = await patchGraphOverlayConfig(updates);
      return reply.send({
        ok: true,
        data: config,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[GraphOverlay] Admin routes registered at /api/admin/connections/graph/overlay/*');
}
