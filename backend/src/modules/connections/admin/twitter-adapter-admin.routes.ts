/**
 * Twitter Adapter Admin Routes
 * 
 * Unified admin API for Twitter adapter control.
 * Guards: read-only, alerts disabled, parser untouched.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import {
  getConfig,
  updateConfig,
  setMode,
  setWeights,
  rollbackToSafe,
  initTwitterAdapterConfigStore,
  type AdapterMode,
} from '../storage/twitter-adapter-config.store.js';
import { getTwitterAdapterFullStatus, getQuickStatus } from '../adapters/twitter/twitter-adapter-status.service.js';
import { calculateBlendedScores, getBlendConfig } from '../adapters/twitter/blend/partialBlend.service.js';
import { compareMockVsLive } from '../twitter-live/twitterLive.diff.js';

// Initialize store on module load
let storeInitialized = false;

async function ensureStoreInit() {
  if (!storeInitialized) {
    const db = getMongoDb();
    initTwitterAdapterConfigStore(db);
    storeInitialized = true;
  }
}

export async function registerTwitterAdapterAdminRoutes(app: FastifyInstance) {
  await ensureStoreInit();
  
  // GET /status - Quick status
  app.get('/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const db = getMongoDb();
    const status = await getQuickStatus(db);
    return reply.send({ ok: true, data: status });
  });

  // GET /full-status - Complete status for admin panel
  app.get('/full-status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const db = getMongoDb();
    const status = await getTwitterAdapterFullStatus(db);
    return reply.send({ ok: true, data: status });
  });

  // GET /config - Get current config
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = await getConfig();
    return reply.send({ ok: true, data: config });
  });

  // PATCH /mode - Change adapter mode
  app.patch('/mode', async (req: FastifyRequest, reply: FastifyReply) => {
    const { mode } = req.body as { mode: AdapterMode };
    
    if (!['OFF', 'READ_ONLY', 'BLENDED'].includes(mode)) {
      return reply.status(400).send({ ok: false, error: 'Invalid mode. Use: OFF, READ_ONLY, BLENDED' });
    }
    
    // Safety check: BLENDED requires data
    if (mode === 'BLENDED') {
      const db = getMongoDb();
      const status = await getTwitterAdapterFullStatus(db);
      if (!status.data.available) {
        return reply.send({
          ok: true,
          data: await setMode(mode, 'admin'),
          warning: 'BLENDED mode set but no data available - effectively same as OFF',
        });
      }
    }
    
    const config = await setMode(mode, 'admin');
    console.log(`[TwitterAdapterAdmin] Mode changed to ${mode}`);
    return reply.send({ ok: true, data: config });
  });

  // PATCH /weights - Update blend weights
  app.patch('/weights', async (req: FastifyRequest, reply: FastifyReply) => {
    const { engagement, trend, confidence_gate } = req.body as {
      engagement?: number;
      trend?: number;
      confidence_gate?: number;
    };
    
    const updates: any = {};
    if (engagement !== undefined) updates.engagement = engagement;
    if (trend !== undefined) updates.trend = trend;
    
    const config = await updateConfig(
      {
        weights: updates,
        confidence_gate: confidence_gate,
      },
      'admin',
      'Weights updated via admin panel'
    );
    
    console.log(`[TwitterAdapterAdmin] Weights updated:`, updates);
    return reply.send({ ok: true, data: config });
  });

  // POST /dry-run - Run blend calculation without applying
  app.post('/dry-run', async (_req: FastifyRequest, reply: FastifyReply) => {
    const db = getMongoDb();
    const result = await calculateBlendedScores(db);
    
    return reply.send({
      ok: true,
      data: {
        mode: 'DRY_RUN',
        results_count: result.results.length,
        blended_count: result.stats.blended_count,
        mock_only_count: result.stats.mock_only_count,
        avg_delta: result.stats.avg_delta,
        config_used: result.config,
        sample_results: result.results.slice(0, 5).map(r => ({
          author: r.username,
          mock: r.mock_score.toFixed(3),
          blended: r.blended_score.toFixed(3),
          delta: (r.blended_score - r.mock_score).toFixed(3),
          blend_applied: r.blend_applied,
        })),
        warnings: result.warnings,
      },
    });
  });

  // POST /diff - Compare mock vs live
  app.post('/diff', async (req: FastifyRequest, reply: FastifyReply) => {
    const db = getMongoDb();
    const { mock_authors = 10, mock_engagements = 100 } = req.body as {
      mock_authors?: number;
      mock_engagements?: number;
    };
    
    const diff = await compareMockVsLive(db, {
      authors_count: mock_authors,
      engagements_count: mock_engagements,
      avg_score: 0.6,
      confidence: 0.7,
    });
    
    return reply.send({ ok: true, data: diff });
  });

  // POST /rollback - Rollback to safe mode (OFF, weights=0)
  app.post('/rollback', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = await rollbackToSafe('admin');
    console.log('[TwitterAdapterAdmin] Rollback to safe mode');
    return reply.send({
      ok: true,
      data: config,
      message: 'Rolled back to safe mode: OFF, all weights = 0',
    });
  });

  // GET /locks - Show hard locks (read-only info)
  app.get('/locks', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = await getConfig();
    return reply.send({
      ok: true,
      data: {
        locks: config.locks,
        caps: config.caps,
        explanation: {
          read_only: 'Twitter adapter NEVER writes to twitter_results',
          alerts_disabled: 'Alerts from Twitter data disabled until Phase T2.2+',
          parser_untouched: 'Twitter parser is completely separate, we only read its output',
          network_locked: 'Network weight locked at 0 until follow graph available',
          authority_locked: 'Authority weight locked at 0 until follow graph available',
        },
      },
    });
  });

  console.log('[TwitterAdapterAdmin] Routes registered at /api/admin/connections/twitter-adapter/*');
}
