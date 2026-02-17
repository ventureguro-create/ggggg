/**
 * БЛОК 20-21 — Alpha Surfaces Routes
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { AlphaSurfacesService } from './alpha.service.js';
import { AlphaOutcomeTrackerJob } from './alpha-outcome-tracker.job.js';
import { AlphaSurfaceType } from './alpha.types.js';

// Singleton for alpha tracker job
let alphaTrackerJob: AlphaOutcomeTrackerJob | null = null;

export async function registerAlphaRoutes(app: FastifyInstance, db: Db): Promise<void> {
  const service = new AlphaSurfacesService(db);
  alphaTrackerJob = new AlphaOutcomeTrackerJob(db);

  // GET /api/alpha/top - top alpha candidates
  app.get('/api/alpha/top', async (req, reply) => {
    const { surface, limit = '10' } = req.query as any;
    const candidates = await service.getTopCandidates(
      surface as AlphaSurfaceType | undefined,
      Number(limit)
    );
    return reply.send({ ok: true, data: candidates });
  });

  // GET /api/alpha/health - system stats (BLOCK 21)
  app.get('/api/alpha/health', async (req, reply) => {
    const stats = await service.getSystemStats();
    return reply.send({ ok: true, data: stats });
  });

  // GET /api/admin/alpha/stats - detailed admin stats
  app.get('/api/admin/alpha/stats', async (req, reply) => {
    const stats = await service.getSystemStats();
    const candidates = await service.getTopCandidates(undefined, 50);
    return reply.send({ 
      ok: true, 
      data: { 
        stats, 
        recentCandidates: candidates.length,
        surfaces: {
          immediate: candidates.filter(c => c.surface === 'IMMEDIATE_MOMENTUM').length,
          rotation: candidates.filter(c => c.surface === 'NARRATIVE_ROTATION').length,
          crowded: candidates.filter(c => c.surface === 'CROWDED_TRADE').length,
        }
      } 
    });
  });

  // POST /api/admin/alpha/candidate - create candidate
  app.post('/api/admin/alpha/candidate', async (req, reply) => {
    const data = req.body as any;
    const candidate = await service.createCandidate(data);
    if (!candidate) {
      return reply.status(400).send({ ok: false, error: 'Scores below threshold' });
    }
    return reply.send({ ok: true, data: candidate });
  });

  // POST /api/admin/alpha/outcome - record outcome (BLOCK 21)
  app.post('/api/admin/alpha/outcome', async (req, reply) => {
    const data = req.body as any;
    await service.recordOutcome(data);
    return reply.send({ ok: true });
  });

  // === ALPHA TRACKER JOB API ===

  // POST /api/admin/alpha/jobs/tracker/start - start alpha tracker
  app.post('/api/admin/alpha/jobs/tracker/start', async (req, reply) => {
    if (!alphaTrackerJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    alphaTrackerJob.start();
    return reply.send({ ok: true, message: 'Alpha tracker started' });
  });

  // POST /api/admin/alpha/jobs/tracker/stop - stop alpha tracker
  app.post('/api/admin/alpha/jobs/tracker/stop', async (req, reply) => {
    if (!alphaTrackerJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    alphaTrackerJob.stop();
    return reply.send({ ok: true, message: 'Alpha tracker stopped' });
  });

  // GET /api/admin/alpha/jobs/tracker/status - get tracker status
  app.get('/api/admin/alpha/jobs/tracker/status', async (req, reply) => {
    if (!alphaTrackerJob) {
      return reply.send({ ok: true, data: { running: false, pending: {} } });
    }
    const status = await alphaTrackerJob.getStatus();
    return reply.send({ ok: true, data: status });
  });

  // POST /api/admin/alpha/jobs/tracker/run-cycle - manually run cycle
  app.post('/api/admin/alpha/jobs/tracker/run-cycle', async (req, reply) => {
    if (!alphaTrackerJob) {
      return reply.status(500).send({ ok: false, error: 'Job not initialized' });
    }
    await alphaTrackerJob.runCycle();
    return reply.send({ ok: true, message: 'Cycle completed' });
  });

  // GET /api/admin/alpha/outcomes - get recent outcomes
  app.get('/api/admin/alpha/outcomes', async (req, reply) => {
    const { asset, limit = '50' } = req.query as any;
    const query: any = {};
    if (asset) query.asset = asset.toUpperCase();

    const outcomes = await db.collection('alpha_outcomes')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();

    return reply.send({ ok: true, data: outcomes });
  });
}
