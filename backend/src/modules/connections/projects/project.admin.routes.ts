/**
 * Project Admin Routes - E2 Phase
 * 
 * Admin API for managing projects, backers, accounts.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as ProjectStore from './project.store.js';
import type { 
  CreateProjectInput, 
  UpdateProjectInput, 
  LinkBackerInput, 
  LinkAccountInput 
} from './project.types.js';

export function registerProjectAdminRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/admin/connections/projects';
  
  // ============================================================
  // PROJECT CRUD
  // ============================================================
  
  /**
   * POST /projects
   * Create a new project
   */
  app.post(PREFIX, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as CreateProjectInput;
      
      if (!input.slug || !input.name || !input.categories?.length) {
        return reply.code(400).send({
          ok: false,
          error: 'VALIDATION_ERROR',
          message: 'Required: slug, name, categories',
        });
      }
      
      const project = await ProjectStore.createProject(input);
      
      return reply.code(201).send({
        ok: true,
        data: project,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        return reply.code(409).send({ ok: false, error: 'PROJECT_EXISTS' });
      }
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * PATCH /projects/:id
   * Update a project
   */
  app.patch(`${PREFIX}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const input = request.body as UpdateProjectInput;
      
      const project = await ProjectStore.updateProject(id, input);
      
      if (!project) {
        return reply.code(404).send({ ok: false, error: 'PROJECT_NOT_FOUND' });
      }
      
      return reply.send({ ok: true, data: project });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // BACKER LINKS
  // ============================================================
  
  /**
   * POST /projects/:id/backers
   * Link a backer to a project
   */
  app.post(`${PREFIX}/:id/backers`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Omit<LinkBackerInput, 'projectId'>;
      
      if (!body.backerId) {
        return reply.code(400).send({ ok: false, error: 'backerId required' });
      }
      
      await ProjectStore.linkBacker({ projectId: id, ...body });
      
      return reply.send({ ok: true, message: 'Backer linked' });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * DELETE /projects/:id/backers/:backerId
   * Unlink a backer from a project
   */
  app.delete(`${PREFIX}/:id/backers/:backerId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, backerId } = request.params as { id: string; backerId: string };
      
      await ProjectStore.unlinkBacker(id, backerId);
      
      return reply.send({ ok: true, message: 'Backer unlinked' });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // ACCOUNT LINKS
  // ============================================================
  
  /**
   * POST /projects/:id/accounts
   * Link an account to a project
   */
  app.post(`${PREFIX}/:id/accounts`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Omit<LinkAccountInput, 'projectId'>;
      
      if (!body.actorId || !body.role) {
        return reply.code(400).send({ ok: false, error: 'actorId and role required' });
      }
      
      await ProjectStore.linkAccount({ projectId: id, ...body });
      
      return reply.send({ ok: true, message: 'Account linked' });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * DELETE /projects/:id/accounts/:actorId
   * Unlink an account from a project
   */
  app.delete(`${PREFIX}/:id/accounts/:actorId`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, actorId } = request.params as { id: string; actorId: string };
      
      await ProjectStore.unlinkAccount(id, actorId);
      
      return reply.send({ ok: true, message: 'Account unlinked' });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // RECOMPUTE
  // ============================================================
  
  /**
   * POST /projects/:id/recompute
   * Force recompute project authority
   */
  app.post(`${PREFIX}/:id/recompute`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const score = await ProjectStore.recomputeProjectAuthority(id);
      
      return reply.send({
        ok: true,
        data: { authorityScore: score },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[Projects] Admin routes registered at ${PREFIX}/* (E2 Phase)`);
}
