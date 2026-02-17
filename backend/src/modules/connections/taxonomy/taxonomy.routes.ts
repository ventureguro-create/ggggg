/**
 * Taxonomy v2 - Routes
 * 
 * Public and Admin API endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TAXONOMY_GROUPS } from './taxonomy.constants.js';
import { PRESET_TO_GROUP, PRESET_DEFINITIONS, PresetKey } from './taxonomy.presets.js';
import { TaxonomyGroupKey } from './taxonomy.types.js';
import {
  initTaxonomyEngine,
  getRules,
  getAccountMemberships,
  getAccountsByGroup,
  recomputeTaxonomy,
  computeTaxonomyLabels,
} from './taxonomy.engine.js';
import {
  initTaxonomyStore,
  getOrCreateRules,
  patchRules,
  setMembershipFrozen,
  adminOverrideMembership,
  getTaxonomyStats,
} from './taxonomy.store.js';
import { Db } from 'mongodb';

/**
 * Seed taxonomy from unified accounts on startup
 */
async function seedTaxonomyFromUnified(db: Db) {
  const accounts = await db.collection('connections_unified_accounts')
    .find({})
    .limit(200)
    .toArray();

  if (accounts.length === 0) {
    console.log('[Taxonomy] No unified accounts to seed');
    return;
  }

  const rows = accounts.map(acc => ({
    accountId: acc.id || String(acc._id),
    metrics: {
      smart_followers_score_0_1: acc.smart || acc.score?.smart || Math.random() * 0.5 + 0.3,
      authority_score_0_1: acc.authority || acc.score?.authority || Math.random() * 0.5 + 0.2,
      influence_score_0_1: acc.influence || acc.score?.influence || Math.random() * 0.5 + 0.2,
      early_signal_score_0_1: acc.early || acc.score?.early || Math.random() * 0.4 + 0.2,
      network_embedding_0_1: Math.random() * 0.5 + 0.2,
      seed_authority_0_1: acc.kind === 'BACKER' ? 0.8 : Math.random() * 0.3,
      coinvest_centrality_0_1: acc.kind === 'BACKER' ? 0.7 : Math.random() * 0.3,
      is_backer: acc.kind === 'BACKER',
      kind: acc.kind,
    },
  }));

  const result = await recomputeTaxonomy(rows);
  console.log(`[Taxonomy] Seeded ${result.updated} memberships from unified accounts`);
}

export function registerTaxonomyRoutes(app: FastifyInstance, db: Db) {
  initTaxonomyEngine(db);
  initTaxonomyStore(db);
  
  // Seed taxonomy on startup (async, non-blocking)
  seedTaxonomyFromUnified(db).catch(err => {
    console.log('[Taxonomy] Seed failed:', err.message);
  });

  // === PUBLIC ROUTES ===

  // GET /api/connections/taxonomy/groups - List all groups
  app.get('/api/connections/taxonomy/groups', async () => {
    return { ok: true, data: TAXONOMY_GROUPS };
  });

  // GET /api/connections/taxonomy/presets - List all presets
  app.get('/api/connections/taxonomy/presets', async () => {
    return { ok: true, data: PRESET_DEFINITIONS };
  });

  // GET /api/connections/taxonomy/memberships - Get memberships for account
  app.get('/api/connections/taxonomy/memberships', async (req: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = req.query as { accountId?: string };
    if (!accountId) {
      return reply.code(400).send({ ok: false, error: 'accountId required' });
    }
    const memberships = await getAccountMemberships(accountId);
    return { ok: true, data: memberships };
  });

  // GET /api/connections/taxonomy/by-group - Get accounts by group
  app.get('/api/connections/taxonomy/by-group', async (req: FastifyRequest) => {
    const { group, preset, limit = '50', minWeight = '0.2' } = req.query as {
      group?: TaxonomyGroupKey;
      preset?: PresetKey;
      limit?: string;
      minWeight?: string;
    };

    const targetGroup = preset ? PRESET_TO_GROUP[preset] : group;
    if (!targetGroup) {
      return { ok: false, error: 'group or preset required' };
    }

    const accounts = await getAccountsByGroup(targetGroup, {
      limit: parseInt(limit),
      minWeight: parseFloat(minWeight),
    });

    return { ok: true, group: targetGroup, data: accounts };
  });

  // GET /api/connections/taxonomy/:actorId - Compute labels for account
  app.get('/api/connections/taxonomy/:actorId', async (req: FastifyRequest) => {
    const { actorId } = req.params as { actorId: string };

    // Try to get cached memberships first
    const cached = await getAccountMemberships(actorId);
    if (cached.length > 0) {
      return {
        ok: true,
        actorId,
        labels: cached.map(m => ({ key: m.group, weight: m.weight, reasons: m.reasons })),
        source: 'cached',
      };
    }

    // Compute fresh (need metrics from unified)
    const rules = await getRules();
    const metrics = await loadAccountMetrics(db, actorId);
    const labels = computeTaxonomyLabels(metrics, rules);

    return {
      ok: true,
      actorId,
      labels,
      source: 'computed',
    };
  });

  // === ADMIN ROUTES ===

  // GET /api/admin/connections/taxonomy/rules
  app.get('/api/admin/connections/taxonomy/rules', async () => {
    const rules = await getOrCreateRules();
    return { ok: true, data: rules };
  });

  // PATCH /api/admin/connections/taxonomy/rules
  app.patch('/api/admin/connections/taxonomy/rules', async (req: FastifyRequest) => {
    const patch = req.body as any;
    const updated = await patchRules(patch);
    return { ok: true, data: updated };
  });

  // POST /api/admin/connections/taxonomy/recompute - Batch recompute
  app.post('/api/admin/connections/taxonomy/recompute', async (req: FastifyRequest) => {
    const { rows } = (req.body ?? {}) as { rows?: { accountId: string; metrics: any }[] };

    if (!rows || rows.length === 0) {
      // If no rows provided, load from unified accounts
      const accounts = await db.collection('connections_unified_accounts')
        .find({})
        .limit(500)
        .toArray();

      const mappedRows = accounts.map(acc => ({
        accountId: acc.id || String(acc._id),
        metrics: acc,
      }));

      const result = await recomputeTaxonomy(mappedRows);
      return { ok: true, message: `Recomputed from unified`, ...result };
    }

    const result = await recomputeTaxonomy(rows);
    return { ok: true, ...result };
  });

  // POST /api/admin/connections/taxonomy/freeze
  app.post('/api/admin/connections/taxonomy/freeze', async (req: FastifyRequest) => {
    const { accountId, group, isFrozen } = (req.body ?? {}) as {
      accountId: string;
      group: TaxonomyGroupKey;
      isFrozen: boolean;
    };
    await setMembershipFrozen(accountId, group, !!isFrozen);
    return { ok: true };
  });

  // PATCH /api/admin/connections/taxonomy/memberships/:id - Admin override
  app.patch('/api/admin/connections/taxonomy/memberships/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { weight, reasons } = (req.body ?? {}) as { weight?: number; reasons?: string[] };

    // Find existing
    const existing = await db.collection('connections_taxonomy_membership').findOne({ _id: id });
    if (!existing) {
      return reply.code(404).send({ ok: false, error: 'Not found' });
    }

    await adminOverrideMembership(
      existing.accountId,
      existing.group,
      weight ?? existing.weight,
      reasons ?? existing.reasons
    );
    return { ok: true };
  });

  // GET /api/admin/connections/taxonomy/stats
  app.get('/api/admin/connections/taxonomy/stats', async () => {
    const stats = await getTaxonomyStats();
    return { ok: true, data: stats };
  });

  console.log('[Taxonomy] Routes registered');
}

/**
 * Load metrics for an account (from unified or mock)
 */
async function loadAccountMetrics(db: Db, actorId: string): Promise<any> {
  // Try unified accounts
  const unified = await db.collection('connections_unified_accounts').findOne({ id: actorId });
  if (unified) return unified;

  // Try author profiles
  const author = await db.collection('connections_author_profiles').findOne({ id: actorId });
  if (author) return author;

  // Return mock metrics
  return {
    id: actorId,
    smart_followers_score_0_1: Math.random() * 0.5 + 0.3,
    authority_score_0_1: Math.random() * 0.5 + 0.2,
    influence_score_0_1: Math.random() * 0.5 + 0.2,
    early_signal_score_0_1: Math.random() * 0.4 + 0.2,
  };
}
