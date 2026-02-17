/**
 * Follow Graph v2 - API Routes
 * 
 * Endpoints:
 * - GET /api/connections/follow/edges - get follow edges
 * - GET /api/connections/follow/followers/:id - who follows this account
 * - GET /api/connections/follow/following/:id - who this account follows
 * - GET /api/connections/follow/stats - follow graph statistics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { buildFollowGraph, getFollowScore, getFollowBadge } from './follow.service.js';
import { getFollowEdges } from './follow.reader.js';

export async function followRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/connections/follow/edges
   * Get all follow edges with weights
   */
  fastify.get('/follow/edges', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        authorId?: string;
        limit?: string;
        minWeight?: string;
      };
      
      const db = getMongoDb();
      
      // Get account authorities from unified accounts
      const accounts = await db.collection('connections_unified_accounts').find({}).toArray();
      const authorities = new Map<string, number>();
      for (const acc of accounts) {
        authorities.set(
          acc.id || String(acc._id),
          acc.authority ?? acc.seedAuthority ?? acc.smart ?? 0.5
        );
      }
      
      const result = await buildFollowGraph(db, authorities, {
        limit: parseInt(query.limit || '200'),
        minWeight: parseFloat(query.minWeight || '0.01'),
      });
      
      // Filter by authorId if provided
      let edges = result.edges;
      if (query.authorId) {
        edges = edges.filter(e => 
          e.source === query.authorId || e.target === query.authorId
        );
      }
      
      return {
        ok: true,
        data: {
          edges,
          stats: result.stats,
        },
      };
    } catch (err: any) {
      fastify.log.error(`[Follow] Edges error: ${err.message}`);
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /api/connections/follow/followers/:id
   * Get who follows this account (with authority info)
   */
  fastify.get<{ Params: { id: string } }>(
    '/follow/followers/:id',
    async (request, reply) => {
      try {
        const { id } = request.params;
        const db = getMongoDb();
        
        // Get authorities
        const accounts = await db.collection('connections_unified_accounts').find({}).toArray();
        const authorities = new Map<string, number>();
        const labels = new Map<string, string>();
        for (const acc of accounts) {
          const accId = acc.id || String(acc._id);
          authorities.set(accId, acc.authority ?? acc.seedAuthority ?? acc.smart ?? 0.5);
          labels.set(accId, acc.title || acc.label || acc.handle || accId);
        }
        
        const result = await buildFollowGraph(db, authorities);
        const followers = result.byTarget.get(id) || [];
        
        const score = getFollowScore(id, result.byTarget);
        const badge = getFollowBadge(id, result.byTarget);
        
        return {
          ok: true,
          data: {
            accountId: id,
            followScore: score,
            badge: badge.hasBadge ? 'FOLLOWED_BY_TOP' : null,
            followerCount: followers.length,
            followers: followers.map(f => ({
              id: f.fromAuthorId,
              label: labels.get(f.fromAuthorId) || f.fromAuthorId,
              authority: f.followerAuthority,
              weight: f.weight.finalWeight,
              followedAt: f.followedAt,
            })).sort((a, b) => b.authority - a.authority).slice(0, 20),
            topFollowers: badge.topFollowers.map(id => ({
              id,
              label: labels.get(id) || id,
            })),
          },
        };
      } catch (err: any) {
        fastify.log.error(`[Follow] Followers error: ${err.message}`);
        return reply.status(500).send({ ok: false, error: err.message });
      }
    }
  );
  
  /**
   * GET /api/connections/follow/following/:id
   * Get who this account follows
   */
  fastify.get<{ Params: { id: string } }>(
    '/follow/following/:id',
    async (request, reply) => {
      try {
        const { id } = request.params;
        const db = getMongoDb();
        
        // Get authorities and labels
        const accounts = await db.collection('connections_unified_accounts').find({}).toArray();
        const authorities = new Map<string, number>();
        const labels = new Map<string, string>();
        for (const acc of accounts) {
          const accId = acc.id || String(acc._id);
          authorities.set(accId, acc.authority ?? acc.seedAuthority ?? acc.smart ?? 0.5);
          labels.set(accId, acc.title || acc.label || acc.handle || accId);
        }
        
        const result = await buildFollowGraph(db, authorities);
        const following = result.bySource.get(id) || [];
        
        return {
          ok: true,
          data: {
            accountId: id,
            followingCount: following.length,
            following: following.map(f => ({
              id: f.toAuthorId,
              label: labels.get(f.toAuthorId) || f.toAuthorId,
              authority: authorities.get(f.toAuthorId) || 0.5,
              weight: f.weight.finalWeight,
              followedAt: f.followedAt,
            })).sort((a, b) => b.authority - a.authority).slice(0, 20),
          },
        };
      } catch (err: any) {
        fastify.log.error(`[Follow] Following error: ${err.message}`);
        return reply.status(500).send({ ok: false, error: err.message });
      }
    }
  );
  
  /**
   * GET /api/connections/follow/stats
   * Get follow graph statistics
   */
  fastify.get('/follow/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getMongoDb();
      
      // Get authorities
      const accounts = await db.collection('connections_unified_accounts').find({}).toArray();
      const authorities = new Map<string, number>();
      const labels = new Map<string, string>();
      for (const acc of accounts) {
        const accId = acc.id || String(acc._id);
        authorities.set(accId, acc.authority ?? acc.seedAuthority ?? acc.smart ?? 0.5);
        labels.set(accId, acc.title || acc.label || acc.handle || accId);
      }
      
      const result = await buildFollowGraph(db, authorities);
      
      return {
        ok: true,
        data: {
          ...result.stats,
          topFollowed: result.stats.topFollowed.map(t => ({
            ...t,
            label: labels.get(t.id) || t.id,
          })),
        },
      };
    } catch (err: any) {
      fastify.log.error(`[Follow] Stats error: ${err.message}`);
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log('[Follow] Routes registered at /api/connections/follow');
}
