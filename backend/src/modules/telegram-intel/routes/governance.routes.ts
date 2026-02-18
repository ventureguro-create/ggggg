/**
 * Governance Routes
 * Phase 4: Config + Overrides management
 */
import { FastifyPluginAsync } from 'fastify';
import { GovernanceService } from '../governance/governance.service.js';
import { TgScoringConfigModel, TgOverridesModel } from '../governance/governance.model.js';

export const governanceRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const gov = new GovernanceService(log);

  // Get active config
  fastify.get('/api/admin/telegram-intel/governance/config/active', async () => {
    return { ok: true, config: await gov.getActiveConfig('intel_v1') };
  });

  // List all config versions
  fastify.get('/api/admin/telegram-intel/governance/config/list', async () => {
    const items = await TgScoringConfigModel.find({ key: 'intel_v1' })
      .sort({ version: -1 })
      .lean();
    return { ok: true, items };
  });

  // Activate specific version
  fastify.post('/api/admin/telegram-intel/governance/config/activate', async (req) => {
    const body = (req.body as any) || {};
    return gov.setActiveVersion('intel_v1', Number(body.version));
  });

  // Create new config version
  fastify.post('/api/admin/telegram-intel/governance/config/create', async (req) => {
    const body = (req.body as any) || {};
    return gov.createConfigVersion(
      body.key || 'intel_v1',
      body.payload,
      body.createdBy || 'admin'
    );
  });

  // Upsert override
  fastify.post('/api/admin/telegram-intel/governance/override', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '')
      .replace(/^@/, '')
      .toLowerCase()
      .trim();

    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    const patch = {
      status: body.status,
      forcedTier: body.forcedTier ?? null,
      forcedScore: body.forcedScore ?? null,
      fraudRiskOverride: body.fraudRiskOverride ?? null,
      penaltyMultiplier: body.penaltyMultiplier ?? null,
      notes: body.notes ?? '',
      updatedBy: body.updatedBy ?? 'admin',
    };

    return gov.upsertOverride(username, patch);
  });

  // Get override for channel
  fastify.get('/api/admin/telegram-intel/governance/override/:username', async (req) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();

    const doc = await gov.getOverride(u);
    return { ok: true, doc: doc || null };
  });

  // List all overrides
  fastify.get('/api/admin/telegram-intel/governance/overrides', async (req) => {
    const q = (req.query as any) || {};
    const items = await gov.listOverrides(q.status || undefined);
    return { ok: true, items };
  });

  fastify.log.info('[governance] routes registered');
};
