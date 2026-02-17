/**
 * Backer Admin Routes
 * 
 * Admin API for managing Backers (funds, projects, DAOs)
 * and their bindings to Twitter accounts.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as BackerStore from './backer.store.js';
import * as InheritanceEngine from './backer.inheritance.engine.js';
import type {
  CreateBackerInput,
  UpdateBackerInput,
  CreateBindingInput,
  BackerListFilters,
} from './backer.types.js';
import { ACCOUNT_CATEGORIES, ACCOUNT_SUBTYPES, CATEGORY_SUBTYPES } from './backer.types.js';

export function registerBackerAdminRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/backers';
  
  // ============================================================
  // BACKER CRUD
  // ============================================================
  
  // GET /backers - List all backers
  app.get(`${PREFIX}`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as BackerListFilters;
      const backers = await BackerStore.listBackers(query);
      const stats = await BackerStore.getBackerStats();
      
      return reply.send({
        ok: true,
        data: {
          backers,
          count: backers.length,
          stats,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // GET /backers/:id - Get single backer
  app.get(`${PREFIX}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const backer = await BackerStore.getBackerById(id);
      
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      // Get bindings
      const bindings = await BackerStore.getBindingsByBacker(id);
      
      return reply.send({
        ok: true,
        data: {
          backer,
          bindings,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // POST /backers - Create backer
  app.post(`${PREFIX}`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as CreateBackerInput;
      
      // Validate
      if (!input.slug || !input.name || !input.type) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'VALIDATION_ERROR',
          message: 'slug, name, and type are required',
        });
      }
      
      if (input.seedAuthority < 0 || input.seedAuthority > 100) {
        return reply.code(400).send({
          ok: false,
          error: 'VALIDATION_ERROR',
          message: 'seedAuthority must be 0-100',
        });
      }
      
      // Check slug doesn't exist
      const existing = await BackerStore.getBackerBySlug(input.slug);
      if (existing) {
        return reply.code(409).send({
          ok: false,
          error: 'SLUG_EXISTS',
          message: `Backer with slug "${input.slug}" already exists`,
        });
      }
      
      const backer = await BackerStore.createBacker(input, 'admin');
      
      return reply.code(201).send({
        ok: true,
        message: `Backer "${backer.name}" created`,
        data: backer,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // PATCH /backers/:id - Update backer
  app.patch(`${PREFIX}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const input = request.body as UpdateBackerInput;
      
      const backer = await BackerStore.updateBacker(id, input, 'admin');
      
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        message: 'Backer updated',
        data: backer,
      });
    } catch (err: any) {
      if (err.message.includes('FROZEN')) {
        return reply.code(403).send({ ok: false, error: err.message });
      }
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // DELETE /backers/:id - Soft delete (archive)
  app.delete(`${PREFIX}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const deleted = await BackerStore.deleteBackerSoft(id, 'admin');
      
      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        message: 'Backer archived',
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // FREEZE OPERATIONS
  // ============================================================
  
  // POST /backers/:id/freeze
  app.post(`${PREFIX}/:id/freeze`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const backer = await BackerStore.freezeBacker(id, 'admin');
      
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        message: `Backer "${backer.name}" frozen - no more changes allowed`,
        data: backer,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // POST /backers/:id/unfreeze
  app.post(`${PREFIX}/:id/unfreeze`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const backer = await BackerStore.unfreezeBacker(id, 'admin');
      
      if (!backer) {
        return reply.code(404).send({ ok: false, error: 'BACKER_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        message: `Backer "${backer.name}" unfrozen`,
        data: backer,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // BINDING OPERATIONS
  // ============================================================
  
  // POST /backers/:id/bind - Create binding
  app.post(`${PREFIX}/:id/bind`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Omit<CreateBindingInput, 'backerId'>;
      
      if (!body.targetId || !body.targetType || !body.relation) {
        return reply.code(400).send({
          ok: false,
          error: 'VALIDATION_ERROR',
          message: 'targetId, targetType, and relation are required',
        });
      }
      
      const binding = await BackerStore.createBinding(
        { ...body, backerId: id },
        'admin'
      );
      
      return reply.code(201).send({
        ok: true,
        message: `Binding created: ${id} → ${body.targetId}`,
        data: binding,
      });
    } catch (err: any) {
      if (err.message === 'BACKER_NOT_FOUND') {
        return reply.code(404).send({ ok: false, error: err.message });
      }
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // DELETE /backers/:id/bind/:targetId - Remove binding
  app.delete(`${PREFIX}/:id/bind/:targetId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, targetId } = request.params as { id: string; targetId: string };
      
      const removed = await BackerStore.removeBinding(id, targetId, 'admin');
      
      if (!removed) {
        return reply.code(404).send({ ok: false, error: 'BINDING_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        message: 'Binding removed',
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // POST /backers/:id/bind/:targetId/verify - Verify binding
  app.post(`${PREFIX}/:id/bind/:targetId/verify`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, targetId } = request.params as { id: string; targetId: string };
      
      const binding = await BackerStore.verifyBinding(id, targetId, 'admin');
      
      if (!binding) {
        return reply.code(404).send({ ok: false, error: 'BINDING_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        message: 'Binding verified',
        data: binding,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // INHERITANCE PREVIEW
  // ============================================================
  
  // GET /backers/inheritance/:twitterId - Preview inheritance for account
  app.get(`${PREFIX}/inheritance/:twitterId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { twitterId } = request.params as { twitterId: string };
      
      const inheritance = await InheritanceEngine.resolveInheritedAuthority(twitterId);
      
      return reply.send({
        ok: true,
        data: inheritance,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // STATISTICS
  // ============================================================
  
  // GET /backers/stats - Overall statistics
  app.get(`${PREFIX}/stats`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [backerStats, bindingStats] = await Promise.all([
        BackerStore.getBackerStats(),
        BackerStore.getBindingStats(),
      ]);
      
      return reply.send({
        ok: true,
        data: {
          backers: backerStats,
          bindings: bindingStats,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // TAXONOMY (Phase 2)
  // ============================================================
  
  // GET /backers/taxonomy - Get taxonomy constants
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
  
  // POST /backers/seed-from-unified - Seed backers from VC unified accounts
  app.post(`${PREFIX}/seed-from-unified`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getMongoDb } = await import('../../../db/mongoose.js');
      const db = await getMongoDb();
      
      // Get VC accounts from unified
      const vcAccounts = await db.collection('connections_unified_accounts')
        .find({ categories: { $in: ['VC', 'INFLUENCE'] }, followers: { $gte: 10000 } })
        .sort({ followers: -1 })
        .limit(50)
        .toArray();
      
      // Map unified categories to backer categories
      const mapCategories = (cats: string[]): string[] => {
        const validCategories = ['DEFI', 'INFRA', 'NFT', 'TRADING', 'GAMING', 'SECURITY', 'LAYER1', 'LAYER2', 'SOCIAL', 'DATA', 'ORACLE'];
        // Default to TRADING for financial/VC accounts
        const mapped = cats?.filter(c => validCategories.includes(c)) || [];
        if (mapped.length === 0) mapped.push('TRADING');
        return mapped;
      };
      
      let created = 0;
      for (const acc of vcAccounts) {
        const slug = (acc.handle || '').replace('@', '').toLowerCase();
        if (!slug) continue;
        
        // Check if already exists
        const existing = await BackerStore.getBackerBySlug(slug);
        if (existing) continue;
        
        // Determine type based on followers and categories
        let backerType: 'FUND' | 'PROJECT' | 'DAO' | 'ECOSYSTEM' | 'COMPANY' = 'FUND';
        if (acc.categories?.includes('INFLUENCER')) backerType = 'COMPANY';
        
        // Create backer
        try {
          await BackerStore.createBacker({
            slug,
            name: acc.title || acc.handle?.replace('@', '') || slug,
            description: acc.bio || `Twitter influencer with ${acc.followers?.toLocaleString() || 0} followers`,
            type: backerType,
            categories: mapCategories(acc.categories || []),
            seedAuthority: Math.min(100, Math.round((acc.twitterScore || 50) / 8)),
            confidence: acc.confidence || 0.5,
            externalRefs: {
              website: `https://twitter.com/${slug}`,
            },
            source: 'CURATED',
          }, 'system-seed');
          created++;
        } catch (err: any) {
          console.warn(`[Backers] Failed to create ${slug}:`, err.message);
        }
      }
      
      return reply.send({
        ok: true,
        message: `Seeded ${created} backers from VC unified accounts`,
        created,
        total: vcAccounts.length,
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[Backers] Admin routes registered at ${PREFIX}/*`);
}
