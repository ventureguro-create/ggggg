/**
 * Telegram Intelligence Plugin
 * 
 * Production-ready Telegram data pipeline:
 * - StringSession-only mode (secure, no interactive auth)
 * - Secrets loaded from encrypted file
 * - MTProto runtime with rate limiting, retry, FLOOD_WAIT handling
 * - Incremental cursor-based ingestion
 * - Window-based metrics (7d/30d/90d)
 * - Fraud signal snapshots
 * - Ranking snapshots with breakdown
 * - Nightly pipeline job
 */
import { FastifyPluginAsync } from 'fastify';
import cron from 'node-cron';

import { TelegramRuntime } from './runtime/telegram.runtime.js';
import { JobLockService } from './jobs/job_lock.service.js';
import { IngestionService } from './ingestion/ingestion.service.js';
import { IngestionJob } from './jobs/ingestion.job.js';
import { MetricsPipelineJob } from './jobs/metrics_pipeline.job.js';
import { TgChannelStateModel } from './models/tg.channel_state.model.js';
import { TgMetricsWindowModel } from './models/tg.metrics_window.model.js';
import { TgFraudSignalModel } from './models/tg.fraud_signal.model.js';

export const telegramIntelPlugin: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);

  // Initialize runtime (uses secure secrets loading)
  const rt = new TelegramRuntime({
    rpsGlobal: Number(process.env.TG_RPS_GLOBAL || '2'),
    rpsResolve: Number(process.env.TG_RPS_RESOLVE || '1'),
    rpsHistory: Number(process.env.TG_RPS_HISTORY || '2'),

    maxRetries: Number(process.env.TG_MAX_RETRIES || '6'),
    retryBaseMs: Number(process.env.TG_RETRY_BASE_MS || '750'),

    log,
  });

  await rt.start();

  const lock = new JobLockService();

  const ingestionService = new IngestionService(
    rt,
    {
      profileRefreshHours: Number(process.env.TG_PROFILE_REFRESH_HOURS || '12'),
      cooldownMin: Number(process.env.TG_INGEST_COOLDOWN_MIN || '60'),
      batchLimit: Number(process.env.TG_INGEST_BATCH_LIMIT || '150'),
    },
    log
  );

  const ingestionJob = new IngestionJob(lock, ingestionService, log);
  const metricsJob = new MetricsPipelineJob(log);

  // ==================== Admin Endpoints ====================

  // Run ingestion batch
  fastify.post('/api/admin/telegram-intel/ingestion/run', async (req) => {
    const body = (req.body as any) || {};
    return ingestionJob.runOnce({ limit: Number(body.limit || 10) });
  });

  // Ingest single channel
  fastify.post('/api/admin/telegram-intel/ingestion/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '').trim();
    if (!username) return reply.status(400).send({ ok: false, error: 'username_required' });
    
    try {
      const res = await ingestionService.ingestChannel(username);
      return { ok: true, res };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  // Run metrics pipeline
  fastify.post('/api/admin/telegram-intel/pipeline/run', async () => {
    return metricsJob.run();
  });

  // Run pipeline for single channel
  fastify.post('/api/admin/telegram-intel/pipeline/channel', async (req, reply) => {
    const body = (req.body as any) || {};
    const username = String(body.username || '').trim();
    if (!username) return reply.status(400).send({ ok: false, error: 'username_required' });
    
    try {
      const res = await metricsJob.runSingle(username);
      return { ok: true, res };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  // Get channel state
  fastify.get('/api/admin/telegram-intel/state/:username', async (req, reply) => {
    const { username } = req.params as any;
    const state = await TgChannelStateModel.findOne({ 
      username: String(username).toLowerCase() 
    }).lean();
    
    if (!state) return reply.status(404).send({ ok: false, error: 'not_found' });
    return { ok: true, state: { ...state, _id: undefined } };
  });

  // Get window metrics
  fastify.get('/api/admin/telegram-intel/metrics/:username', async (req, reply) => {
    const { username } = req.params as any;
    const metrics = await TgMetricsWindowModel.find({ 
      username: String(username).toLowerCase() 
    }).lean();
    
    return { ok: true, metrics: metrics.map(m => ({ ...m, _id: undefined })) };
  });

  // Get fraud signals
  fastify.get('/api/admin/telegram-intel/fraud/:username', async (req, reply) => {
    const { username } = req.params as any;
    const fraud = await TgFraudSignalModel.findOne({ 
      username: String(username).toLowerCase() 
    }).lean();
    
    if (!fraud) return reply.status(404).send({ ok: false, error: 'not_found' });
    return { ok: true, fraud: { ...fraud, _id: undefined } };
  });

  // Health check
  fastify.get('/api/admin/telegram-intel/health', async () => {
    return {
      ok: true,
      module: 'telegram-intel',
      version: '1.0.0',
      runtime: {
        connected: rt.isConnected(),
        mode: rt.isMockMode() ? 'mock' : 'live',
      },
    };
  });

  // ==================== Cron Jobs ====================

  const minimalBoot = process.env.MINIMAL_BOOT === '1';

  if (!minimalBoot) {
    // Ingestion: every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        await ingestionJob.runOnce({ limit: 10 });
      } catch (e) {
        fastify.log.error(e, '[telegram-intel] ingestion cron error');
      }
    });

    // Metrics pipeline: every night at 03:00
    cron.schedule('0 3 * * *', async () => {
      try {
        await metricsJob.run();
      } catch (e) {
        fastify.log.error(e, '[telegram-intel] metrics pipeline error');
      }
    });

    log('[telegram-intel] cron jobs scheduled');
  } else {
    log('[telegram-intel] MINIMAL_BOOT=1, cron jobs disabled');
  }

  // ==================== Shutdown ====================

  fastify.addHook('onClose', async () => {
    await rt.stop();
  });

  fastify.log.info('[telegram-intel] plugin loaded');
};
