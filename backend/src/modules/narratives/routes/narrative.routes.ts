/**
 * БЛОК 16-18 — Narrative Routes
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { NarrativeService } from '../services/narrative.service.js';
import { NarrativeCandidatesService } from '../services/narrative-candidates.service.js';
import { NarrativeOutcomeService } from '../services/narrative-outcome.service.js';
import { TwitterNarrativeDetectionService } from '../services/twitter-narrative-detection.service.js';
import { NarrativeOutcomeTrackerJob } from '../jobs/narrative-outcome-tracker.job.js';
import { NMSThresholdDetectorJob } from '../jobs/nms-threshold-detector.job.js';
import { NarrativeState } from '../models/narrative.types.js';

// Singleton instances for jobs
let outcomeTrackerJob: NarrativeOutcomeTrackerJob | null = null;
let nmsDetectorJob: NMSThresholdDetectorJob | null = null;

export async function registerNarrativeRoutes(app: FastifyInstance, db: Db): Promise<void> {
  const narrativeService = new NarrativeService(db);
  const candidatesService = new NarrativeCandidatesService(db);
  const outcomeService = new NarrativeOutcomeService(db);
  const detectionService = new TwitterNarrativeDetectionService(db);

  // Initialize jobs
  outcomeTrackerJob = new NarrativeOutcomeTrackerJob(db);
  nmsDetectorJob = new NMSThresholdDetectorJob(db);

  // === NARRATIVE API ===

  // GET /api/market/narratives - all narratives
  app.get('/api/market/narratives', async (req, reply) => {
    const narratives = await narrativeService.getAllNarratives();
    return reply.send({ ok: true, data: narratives });
  });

  // GET /api/market/narratives/top - top emerging
  app.get('/api/market/narratives/top', async (req, reply) => {
    const { window = '24h', limit = '10' } = req.query as any;
    const states: NarrativeState[] = ['SEEDING', 'IGNITION'];
    const narratives = await narrativeService.getTopNarratives(states, Number(limit));
    return reply.send({ ok: true, data: narratives });
  });

  // GET /api/market/narratives/:key - single narrative
  app.get('/api/market/narratives/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const narrative = await narrativeService.getNarrative(key.toUpperCase());
    if (!narrative) {
      return reply.status(404).send({ ok: false, error: 'Narrative not found' });
    }
    return reply.send({ ok: true, data: narrative });
  });

  // GET /api/market/narratives/:key/outcomes - outcomes for narrative
  app.get('/api/market/narratives/:key/outcomes', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { limit = '50' } = req.query as any;
    const outcomes = await outcomeService.getOutcomes(key.toUpperCase(), Number(limit));
    return reply.send({ ok: true, data: outcomes });
  });

  // GET /api/market/narratives/stats - top predictive
  app.get('/api/market/narratives/stats', async (req, reply) => {
    const { limit = '10' } = req.query as any;
    const stats = await outcomeService.getTopPredictiveNarratives(Number(limit));
    return reply.send({ ok: true, data: stats });
  });

  // === CANDIDATES API ===

  // GET /api/market/narratives/candidates - narrative-based candidates
  app.get('/api/market/narratives/candidates', async (req, reply) => {
    const { window = '24h', limit = '30' } = req.query as any;
    const candidates = await candidatesService.buildCandidates({ window, limit: Number(limit) });
    return reply.send({ ok: true, data: candidates });
  });

  // === ADMIN API ===

  // POST /api/admin/narratives - create/update narrative
  app.post('/api/admin/narratives', async (req, reply) => {
    const data = req.body as any;
    if (!data.key || !data.displayName) {
      return reply.status(400).send({ ok: false, error: 'Missing key or displayName' });
    }
    const narrative = await narrativeService.upsertNarrative(data);
    return reply.send({ ok: true, data: narrative });
  });

  // POST /api/admin/narratives/binding - add token binding
  app.post('/api/admin/narratives/binding', async (req, reply) => {
    const { narrativeKey, symbol, weight = 1.0, reason = 'manual' } = req.body as any;
    if (!narrativeKey || !symbol) {
      return reply.status(400).send({ ok: false, error: 'Missing narrativeKey or symbol' });
    }
    await narrativeService.addBinding({ narrativeKey, symbol, weight, reason, updatedAt: new Date() });
    return reply.send({ ok: true });
  });

  // POST /api/admin/narratives/outcome - record outcome
  app.post('/api/admin/narratives/outcome', async (req, reply) => {
    const data = req.body as any;
    await outcomeService.recordOutcome(data);
    return reply.send({ ok: true });
  });

  // GET /api/market/atoms/trending - trending keywords
  app.get('/api/market/atoms/trending', async (req, reply) => {
    const { limit = '20' } = req.query as any;
    const atoms = await narrativeService.getTrendingAtoms(Number(limit));
    return reply.send({ ok: true, data: atoms });
  });

  // === TWITTER NARRATIVE DETECTION API ===

  // POST /api/admin/narratives/detect - process tweets for narrative detection
  app.post('/api/admin/narratives/detect', async (req, reply) => {
    const { tweets } = req.body as { tweets: any[] };
    if (!tweets || !Array.isArray(tweets)) {
      return reply.status(400).send({ ok: false, error: 'Missing tweets array' });
    }
    const result = await detectionService.processTweetBatch(tweets);
    return reply.send({ 
      ok: true, 
      data: {
        processed: result.processed,
        narratives: Object.fromEntries(result.narratives),
      }
    });
  });

  // POST /api/admin/narratives/detect/single - process single tweet
  app.post('/api/admin/narratives/detect/single', async (req, reply) => {
    const tweet = req.body as any;
    if (!tweet.id || !tweet.text) {
      return reply.status(400).send({ ok: false, error: 'Missing tweet id or text' });
    }
    const result = await detectionService.processTweet({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.authorId || 'unknown',
      authorUsername: tweet.authorUsername || 'unknown',
      createdAt: tweet.createdAt ? new Date(tweet.createdAt) : new Date(),
      metrics: tweet.metrics,
    });
    return reply.send({ ok: true, data: result });
  });

  // POST /api/admin/narratives/recalculate-nms - recalculate all NMS
  app.post('/api/admin/narratives/recalculate-nms', async (req, reply) => {
    await detectionService.recalculateAllNMS();
    return reply.send({ ok: true, message: 'NMS recalculated for all narratives' });
  });

  // GET /api/admin/narratives/patterns - get detection patterns
  app.get('/api/admin/narratives/patterns', async (req, reply) => {
    const patterns = detectionService.getNarrativePatterns();
    return reply.send({ ok: true, data: patterns });
  });

  // === OUTCOME TRACKING JOBS API ===

  // POST /api/admin/narratives/jobs/outcome-tracker/start - start outcome tracker
  app.post('/api/admin/narratives/jobs/outcome-tracker/start', async (req, reply) => {
    if (!outcomeTrackerJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    outcomeTrackerJob.start();
    return reply.send({ ok: true, message: 'Outcome tracker started' });
  });

  // POST /api/admin/narratives/jobs/outcome-tracker/stop - stop outcome tracker
  app.post('/api/admin/narratives/jobs/outcome-tracker/stop', async (req, reply) => {
    if (!outcomeTrackerJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    outcomeTrackerJob.stop();
    return reply.send({ ok: true, message: 'Outcome tracker stopped' });
  });

  // GET /api/admin/narratives/jobs/outcome-tracker/status - get tracker status
  app.get('/api/admin/narratives/jobs/outcome-tracker/status', async (req, reply) => {
    if (!outcomeTrackerJob) {
      return reply.send({ ok: true, data: { running: false, pending: {} } });
    }
    const pending = await outcomeTrackerJob.getPendingCount();
    return reply.send({ ok: true, data: { running: true, pending } });
  });

  // POST /api/admin/narratives/jobs/nms-detector/start - start NMS detector
  app.post('/api/admin/narratives/jobs/nms-detector/start', async (req, reply) => {
    if (!nmsDetectorJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    nmsDetectorJob.start();
    return reply.send({ ok: true, message: 'NMS detector started' });
  });

  // POST /api/admin/narratives/jobs/nms-detector/stop - stop NMS detector
  app.post('/api/admin/narratives/jobs/nms-detector/stop', async (req, reply) => {
    if (!nmsDetectorJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    nmsDetectorJob.stop();
    return reply.send({ ok: true, message: 'NMS detector stopped' });
  });

  // GET /api/admin/narratives/jobs/nms-detector/status - get detector status
  app.get('/api/admin/narratives/jobs/nms-detector/status', async (req, reply) => {
    if (!nmsDetectorJob) {
      return reply.send({ ok: true, data: { running: false } });
    }
    const status = nmsDetectorJob.getStatus();
    return reply.send({ ok: true, data: status });
  });

  // GET /api/admin/narratives/jobs/status - get all jobs status
  app.get('/api/admin/narratives/jobs/status', async (req, reply) => {
    const outcomeStatus = outcomeTrackerJob 
      ? { running: true, pending: await outcomeTrackerJob.getPendingCount() }
      : { running: false, pending: {} };
    const nmsStatus = nmsDetectorJob?.getStatus() || { running: false };

    return reply.send({
      ok: true,
      data: {
        outcomeTracker: outcomeStatus,
        nmsDetector: nmsStatus,
      }
    });
  });

  // POST /api/admin/narratives/jobs/run-cycle - manually run outcome tracker cycle
  app.post('/api/admin/narratives/jobs/run-cycle', async (req, reply) => {
    if (!outcomeTrackerJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    await outcomeTrackerJob.runCycle();
    return reply.send({ ok: true, message: 'Cycle completed' });
  });

  // GET /api/admin/narratives/mentions - get recent mentions
  app.get('/api/admin/narratives/mentions', async (req, reply) => {
    const { narrativeKey, limit = '50' } = req.query as any;
    const query: any = {};
    if (narrativeKey) query.narrativeKey = narrativeKey;

    const mentions = await db.collection('narrative_mentions')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .toArray();

    return reply.send({ ok: true, data: mentions });
  });

  // GET /api/admin/narratives/events - get narrative events
  app.get('/api/admin/narratives/events', async (req, reply) => {
    const { narrativeKey, limit = '50' } = req.query as any;
    const query: any = {};
    if (narrativeKey) query.narrativeKey = narrativeKey;

    const events = await db.collection('narrative_events')
      .find(query)
      .sort({ eventAt: -1 })
      .limit(Number(limit))
      .toArray();

    return reply.send({ ok: true, data: events });
  });
}
