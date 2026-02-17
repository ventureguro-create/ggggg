/**
 * Network v2 Anchor Integration
 * 
 * Integrates anchor resolution into the existing Network v2 flow.
 * This is the bridge between Backers and Network v2.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as AnchorResolver from './anchor.resolver.js';
import type { AnchorScore, AnchorAwareNetworkScore } from './anchor.types.js';

export function registerAnchorRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/network-v2/anchors';
  
  // ============================================================
  // GET /anchors/:twitterId - Get anchors for account
  // ============================================================
  app.get(`${PREFIX}/:twitterId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { twitterId } = request.params as { twitterId: string };
      
      const anchorScore = await AnchorResolver.resolveAnchorsForTwitter(twitterId);
      
      return reply.send({
        ok: true,
        data: {
          twitterId,
          hasAnchors: anchorScore.anchors.length > 0,
          anchors: anchorScore.anchors,
          anchorWeight: anchorScore.anchorWeight,
          anchorConfidence: anchorScore.anchorConfidence,
          networkBoost: anchorScore.networkBoost,
          computedAt: anchorScore.computedAt,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // POST /anchors/batch - Get anchors for multiple accounts
  // ============================================================
  app.post(`${PREFIX}/batch`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { twitterIds: string[] };
      
      if (!body.twitterIds || !Array.isArray(body.twitterIds)) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'twitterIds array required',
        });
      }
      
      const results = await AnchorResolver.resolveAnchorsForBatch(body.twitterIds);
      
      const response: Record<string, any> = {};
      for (const [id, score] of results) {
        response[id] = {
          hasAnchors: score.anchors.length > 0,
          anchorWeight: score.anchorWeight,
          anchorsCount: score.anchors.length,
        };
      }
      
      return reply.send({
        ok: true,
        data: response,
        count: results.size,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /anchors/:twitterId/blend - Blend anchor with graph score
  // ============================================================
  app.get(`${PREFIX}/:twitterId/blend`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { twitterId } = request.params as { twitterId: string };
      const query = request.query as { graphScore?: string };
      
      // Get anchor score
      const anchorScore = await AnchorResolver.resolveAnchorsForTwitter(twitterId);
      
      // Get graph score (from query or default)
      const graphScore = query.graphScore ? parseFloat(query.graphScore) : 50;
      
      // Blend
      const blended = AnchorResolver.blendWithNetworkScore(graphScore, anchorScore);
      
      return reply.send({
        ok: true,
        data: blended,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // GET /anchors/check/:twitterId - Quick check if account is anchored
  // ============================================================
  app.get(`${PREFIX}/check/:twitterId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { twitterId } = request.params as { twitterId: string };
      
      const isAnchor = await AnchorResolver.isAnchorAccount(twitterId);
      
      return reply.send({
        ok: true,
        data: {
          twitterId,
          isAnchor,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[NetworkAnchors] Routes registered at ${PREFIX}/*`);
}
