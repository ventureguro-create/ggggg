/**
 * Twitter Live Routes (Phase 4.2)
 * 
 * API endpoints for read-only Twitter ingestion.
 * NO WRITES. NO ALERTS.
 */

import type { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { getTwitterLiveConfig, updateTwitterLiveConfig, setTwitterLiveMode } from './config.js';
import { readTwitterLiveData } from './reader.js';
import { computeBatchDiff, computeAccountDiff } from './diff.service.js';

export async function registerTwitterLiveRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /status
   * Get Twitter Live status and config
   */
  app.get('/status', async (_req, reply) => {
    const config = getTwitterLiveConfig();
    return reply.send({
      ok: true,
      data: {
        enabled: config.enabled,
        mode: config.mode,
        alerts_disabled: config.alerts_disabled, // Always true
        writes_disabled: config.writes_disabled, // Always true
        max_age_hours: config.max_age_hours,
        safety: 'Phase 4.2: Read-only, no side-effects',
      },
    });
  });
  
  /**
   * POST /toggle
   * Toggle Twitter Live mode (off / read_only / preview)
   */
  app.post('/toggle', async (req, reply) => {
    const { mode } = req.body as { mode?: 'off' | 'read_only' | 'preview' };
    
    if (!mode || !['off', 'read_only', 'preview'].includes(mode)) {
      return reply.status(400).send({
        ok: false,
        error: 'Invalid mode. Must be: off, read_only, or preview',
      });
    }
    
    setTwitterLiveMode(mode);
    const config = getTwitterLiveConfig();
    
    console.log(`[TwitterLive] Mode changed to: ${mode}`);
    
    return reply.send({
      ok: true,
      data: {
        mode: config.mode,
        enabled: config.enabled,
        message: `Twitter Live mode set to: ${mode}`,
      },
    });
  });
  
  /**
   * POST /preview
   * Read Twitter data (read-only preview)
   */
  app.post('/preview', async (req, reply) => {
    const config = getTwitterLiveConfig();
    
    if (!config.enabled || config.mode === 'off') {
      return reply.status(400).send({
        ok: false,
        error: 'Twitter Live is disabled. Enable with POST /toggle { mode: "preview" }',
      });
    }
    
    const { author_ids, limit } = req.body as { author_ids?: string[]; limit?: number };
    
    try {
      const db = getMongoDb();
      const result = await readTwitterLiveData(db, { author_ids, limit });
      
      return reply.send({
        ok: result.success,
        data: {
          mode: 'read_only',
          authors_count: result.authors_count,
          engagements_count: result.engagements_count,
          edges_count: result.edges_count,
          freshness: result.freshness,
          warnings: result.warnings,
          safety: {
            alerts_disabled: true,
            writes_disabled: true,
          },
        },
      });
    } catch (err: any) {
      console.error('[TwitterLive] Preview error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * POST /diff
   * Compare mock vs live data (batch)
   */
  app.post('/diff', async (req, reply) => {
    const config = getTwitterLiveConfig();
    
    if (!config.enabled || config.mode === 'off') {
      return reply.status(400).send({
        ok: false,
        error: 'Twitter Live is disabled',
      });
    }
    
    const { limit } = req.body as { limit?: number };
    
    try {
      const db = getMongoDb();
      const readResult = await readTwitterLiveData(db, { limit: limit || 20 });
      
      if (!readResult.success) {
        return reply.send({
          ok: false,
          error: 'Failed to read Twitter data',
          warnings: readResult.warnings,
        });
      }
      
      const diffResult = computeBatchDiff(
        readResult.authors,
        readResult.engagements,
        readResult.edges
      );
      
      return reply.send({
        ok: true,
        data: {
          ...diffResult,
          safety: {
            alerts_disabled: true,
            writes_disabled: true,
            message: 'Phase 4.2: Read-only comparison, no side-effects',
          },
        },
      });
    } catch (err: any) {
      console.error('[TwitterLive] Diff error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /diff/:authorId
   * Get diff for single author
   */
  app.get('/diff/:authorId', async (req, reply) => {
    const config = getTwitterLiveConfig();
    const { authorId } = req.params as { authorId: string };
    
    if (!config.enabled || config.mode === 'off') {
      return reply.status(400).send({
        ok: false,
        error: 'Twitter Live is disabled',
      });
    }
    
    try {
      const db = getMongoDb();
      const readResult = await readTwitterLiveData(db, { author_ids: [authorId] });
      
      if (!readResult.success || readResult.authors.length === 0) {
        return reply.status(404).send({
          ok: false,
          error: 'Author not found in Twitter data',
          warnings: readResult.warnings,
        });
      }
      
      const author = readResult.authors[0];
      const diff = computeAccountDiff(author, readResult.engagements, readResult.edges);
      
      return reply.send({
        ok: true,
        data: diff,
      });
    } catch (err: any) {
      console.error('[TwitterLive] Single diff error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  // Register Phase 4.3 participation routes
  const { registerParticipationRoutes } = await import('./participation.routes.js');
  await app.register(registerParticipationRoutes);
  
  console.log('[TwitterLive] Routes registered at /api/connections/twitter/live/*');
}
