/**
 * Backer Read Routes
 * 
 * Public API for reading Backers data.
 * Used by Connections frontend tab.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as BackerStore from './backer.store.js';
import * as InheritanceEngine from './backer.inheritance.engine.js';
import type { BackerListFilters } from './backer.types.js';
import { ACCOUNT_CATEGORIES, ACCOUNT_SUBTYPES, CATEGORY_SUBTYPES } from './backer.types.js';

export function registerBackerReadRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/connections/backers';
  
  // ============================================================
  // LIST & FILTER
  // ============================================================
  
  // GET /backers - List backers (public view)
  app.get(`${PREFIX}`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as BackerListFilters;
      
      // Only show active, non-frozen by default
      const filters: BackerListFilters = {
        ...query,
        status: query.status || 'ACTIVE',
      };
      
      const backers = await BackerStore.listBackers(filters);
      
      return reply.send({
        ok: true,
        data: {
          backers: backers.map(b => ({
            id: b.id,
            slug: b.slug,
            name: b.name,
            description: b.description,
            type: b.type,
            categories: b.categories,
            // Phase 2: Taxonomy
            taxonomy: b.taxonomy,
            seedAuthority: b.seedAuthority,
            confidence: b.confidence,
            externalRefs: b.externalRefs,
          })),
          count: backers.length,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // GET /backers/:slug - Get backer by slug
  app.get(`${PREFIX}/:slug`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      const backer = await BackerStore.getBackerBySlug(slug);
      
      if (!backer || backer.status !== 'ACTIVE') {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      // Get bindings (only show verified)
      const bindings = await BackerStore.getBindingsByBacker(backer.id);
      const verifiedBindings = bindings.filter(b => b.verified);
      
      return reply.send({
        ok: true,
        data: {
          backer: {
            id: backer.id,
            slug: backer.slug,
            name: backer.name,
            description: backer.description,
            type: backer.type,
            categories: backer.categories,
            // Phase 2: Taxonomy
            taxonomy: backer.taxonomy,
            seedAuthority: backer.seedAuthority,
            confidence: backer.confidence,
            externalRefs: backer.externalRefs,
          },
          linkedAccounts: verifiedBindings.map(b => ({
            targetType: b.targetType,
            targetId: b.targetId,
            targetHandle: b.targetHandle,
            relation: b.relation,
          })),
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // BY TYPE
  // ============================================================
  
  // GET /backers/type/funds
  app.get(`${PREFIX}/type/funds`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const backers = await BackerStore.listBackers({ type: 'FUND', status: 'ACTIVE' });
      return reply.send({
        ok: true,
        data: { backers, count: backers.length },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // GET /backers/type/projects
  app.get(`${PREFIX}/type/projects`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const backers = await BackerStore.listBackers({ type: 'PROJECT', status: 'ACTIVE' });
      return reply.send({
        ok: true,
        data: { backers, count: backers.length },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // GET /backers/type/daos
  app.get(`${PREFIX}/type/daos`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const backers = await BackerStore.listBackers({ type: 'DAO', status: 'ACTIVE' });
      return reply.send({
        ok: true,
        data: { backers, count: backers.length },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // LOOKUP BY TWITTER
  // ============================================================
  
  // GET /backers/for-twitter/:twitterId - Find backers for Twitter account
  app.get(`${PREFIX}/for-twitter/:twitterId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { twitterId } = request.params as { twitterId: string };
      
      const bindings = await BackerStore.getBindingsByTarget('TWITTER', twitterId);
      
      if (bindings.length === 0) {
        return reply.send({
          ok: true,
          data: {
            hasBackers: false,
            backers: [],
          },
        });
      }
      
      const backers = await Promise.all(
        bindings.map(async b => {
          const backer = await BackerStore.getBackerById(b.backerId);
          return backer ? { backer, binding: b } : null;
        })
      );
      
      return reply.send({
        ok: true,
        data: {
          hasBackers: true,
          backers: backers
            .filter(Boolean)
            .map(item => ({
              backer: {
                id: item!.backer.id,
                slug: item!.backer.slug,
                name: item!.backer.name,
                type: item!.backer.type,
                seedAuthority: item!.backer.seedAuthority,
              },
              relation: item!.binding.relation,
              verified: item!.binding.verified,
            })),
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // HEALTH
  // ============================================================
  
  app.get(`${PREFIX}/health`, async () => {
    return { ok: true, module: 'backers', status: 'ready' };
  });
  
  // ============================================================
  // TAXONOMY (Phase 2)
  // ============================================================
  
  // GET /backers/taxonomy - Get taxonomy constants (public)
  app.get(`${PREFIX}/taxonomy`, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: {
        categories: ACCOUNT_CATEGORIES,
        subtypes: ACCOUNT_SUBTYPES,
        categorySubtypes: CATEGORY_SUBTYPES,
      },
    });
  });
  
  console.log(`[Backers] Read routes registered at ${PREFIX}/*`);
}
