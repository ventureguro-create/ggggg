/**
 * Project Routes - E2 Phase
 * 
 * Public API for Project Detail Pages.
 * All routes are READ-ONLY.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as ProjectStore from './project.store.js';
import type { ProjectListFilters } from './project.types.js';

export function registerProjectRoutes(app: FastifyInstance): void {
  const PREFIX = '/api/connections/projects';
  
  // ============================================================
  // HEALTH
  // ============================================================
  
  app.get(`${PREFIX}/health`, async () => {
    return { ok: true, module: 'projects', phase: 'E2' };
  });
  
  // ============================================================
  // LIST PROJECTS
  // ============================================================
  
  /**
   * GET /projects
   * List projects with filtering
   */
  app.get(PREFIX, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as ProjectListFilters;
      const projects = await ProjectStore.listProjects(query);
      
      return reply.send({
        ok: true,
        data: {
          projects: projects.map(p => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            categories: p.categories,
            stage: p.stage,
            authorityScore: p.authorityScore,
            realityScore: p.realityScore,
            confidence: p.confidence,
          })),
          count: projects.length,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // PROJECT CORE
  // ============================================================
  
  /**
   * GET /projects/:slug
   * Get project by slug (E2 Core API)
   */
  app.get(`${PREFIX}/:slug`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      const project = await ProjectStore.getProjectBySlug(slug);
      
      if (!project) {
        return reply.code(404).send({ ok: false, error: 'PROJECT_NOT_FOUND' });
      }
      
      return reply.send({
        ok: true,
        data: {
          id: project.id,
          slug: project.slug,
          name: project.name,
          description: project.description,
          categories: project.categories,
          stage: project.stage,
          launchYear: project.launchYear,
          authorityScore: project.authorityScore,
          realityScore: project.realityScore,
          confidence: project.confidence,
          externalRefs: project.externalRefs,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // PROJECT BACKERS (E2.2)
  // ============================================================
  
  /**
   * GET /projects/:id/backers
   * Get backers for a project
   */
  app.get(`${PREFIX}/:id/backers`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const backers = await ProjectStore.getProjectBackers(id);
      
      return reply.send({
        ok: true,
        data: {
          backers: backers.map(b => ({
            backerId: b.backerId,
            backerName: b.backerName,
            backerType: b.backerType,
            seedAuthority: b.seedAuthority,
            coinvestWeight: b.coinvestWeight,
            isAnchor: b.isAnchor,
            anchorReason: b.anchorReason,
            rounds: b.rounds,
          })),
          count: backers.length,
          hasAnchor: backers.some(b => b.isAnchor),
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // PROJECT ACCOUNTS (E2.3)
  // ============================================================
  
  /**
   * GET /projects/:id/accounts
   * Get accounts associated with a project
   */
  app.get(`${PREFIX}/:id/accounts`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const accounts = await ProjectStore.getProjectAccounts(id);
      
      // Group by role
      const byRole: Record<string, typeof accounts> = {};
      for (const acc of accounts) {
        if (!byRole[acc.role]) byRole[acc.role] = [];
        byRole[acc.role].push(acc);
      }
      
      return reply.send({
        ok: true,
        data: {
          accounts: accounts.map(a => ({
            actorId: a.actorId,
            twitterHandle: a.twitterHandle,
            role: a.role,
            authority: a.authority,
            trustMultiplier: a.trustMultiplier,
            realityBadge: a.realityBadge,
          })),
          byRole,
          count: accounts.length,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // PROJECT NETWORK (E2.4)
  // ============================================================
  
  /**
   * GET /projects/:id/network
   * Get local network subgraph for a project
   */
  app.get(`${PREFIX}/:id/network`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const network = await ProjectStore.getProjectNetwork(id);
      
      return reply.send({
        ok: true,
        data: {
          nodes: network.nodes,
          edges: network.edges,
          nodeCount: network.nodes.length,
          edgeCount: network.edges.length,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // RELATED PROJECTS (E2.5)
  // ============================================================
  
  /**
   * GET /projects/:id/related
   * Get related projects with reasons
   */
  app.get(`${PREFIX}/:id/related`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const related = await ProjectStore.getRelatedProjects(id);
      
      return reply.send({
        ok: true,
        data: {
          projects: related.map(r => ({
            projectId: r.projectId,
            projectName: r.projectName,
            projectSlug: r.projectSlug,
            reasons: r.reasons,
            strength: r.strength,
            explain: {
              sharedBackers: r.sharedBackers,
              sharedAccounts: r.sharedAccounts,
            },
          })),
          count: related.length,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // WHY IT MATTERS (E2.6)
  // ============================================================
  
  /**
   * GET /projects/:id/why-it-matters
   * Get generated explanation of why project matters
   */
  app.get(`${PREFIX}/:id/why-it-matters`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const why = await ProjectStore.getWhyItMatters(id);
      
      return reply.send({
        ok: true,
        data: {
          summary: {
            backers: why.backersSummary,
            accounts: why.accountsSummary,
            reality: why.realitySummary,
          },
          details: {
            anchorBackers: why.anchorBackers,
            trustedAccounts: why.trustedAccounts,
            realitySignal: why.realitySignal,
          },
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  // ============================================================
  // FULL PROJECT DETAIL (Combined)
  // ============================================================
  
  /**
   * GET /projects/:slug/full
   * Get complete project detail (all E2 data in one call)
   */
  app.get(`${PREFIX}/:slug/full`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      const project = await ProjectStore.getProjectBySlug(slug);
      
      if (!project) {
        return reply.code(404).send({ ok: false, error: 'PROJECT_NOT_FOUND' });
      }
      
      // Fetch all related data in parallel
      const [backers, accounts, network, related, why] = await Promise.all([
        ProjectStore.getProjectBackers(project.id),
        ProjectStore.getProjectAccounts(project.id),
        ProjectStore.getProjectNetwork(project.id),
        ProjectStore.getRelatedProjects(project.id),
        ProjectStore.getWhyItMatters(project.id),
      ]);
      
      return reply.send({
        ok: true,
        data: {
          project: {
            id: project.id,
            slug: project.slug,
            name: project.name,
            description: project.description,
            categories: project.categories,
            stage: project.stage,
            launchYear: project.launchYear,
            authorityScore: project.authorityScore,
            realityScore: project.realityScore,
            confidence: project.confidence,
            externalRefs: project.externalRefs,
          },
          backers: {
            list: backers,
            hasAnchor: backers.some(b => b.isAnchor),
          },
          accounts: {
            list: accounts,
            byRole: groupByRole(accounts),
          },
          network: {
            nodes: network.nodes,
            edges: network.edges,
          },
          related: related,
          whyItMatters: {
            summary: {
              backers: why.backersSummary,
              accounts: why.accountsSummary,
              reality: why.realitySummary,
            },
            anchorBackers: why.anchorBackers,
            trustedAccounts: why.trustedAccounts,
            realitySignal: why.realitySignal,
          },
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
  
  console.log(`[Projects] Routes registered at ${PREFIX}/* (E2 Phase)`);
}

// Helper to group accounts by role
function groupByRole(accounts: any[]): Record<string, any[]> {
  const byRole: Record<string, any[]> = {};
  for (const acc of accounts) {
    if (!byRole[acc.role]) byRole[acc.role] = [];
    byRole[acc.role].push(acc);
  }
  return byRole;
}
