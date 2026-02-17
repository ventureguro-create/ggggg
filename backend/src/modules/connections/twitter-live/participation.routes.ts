/**
 * Live Participation Routes (Phase 4.3)
 * 
 * Admin APIs for controlling live data participation.
 */

import type { FastifyInstance } from 'fastify';
import { 
  getParticipationConfig, 
  updateParticipationConfig, 
  updateComponentParticipation,
  rollbackAll,
  rollbackComponent,
  type LiveParticipationConfig 
} from './participation.config.js';
import { 
  checkGuards, 
  addAuditEvent, 
  getAuditLog, 
  runMonitor, 
  killSwitch,
  type ComponentMetrics 
} from './participation.guards.js';
import { 
  computeBlendedMetrics, 
  previewBlend, 
  gradeChanged 
} from './participation.blender.js';
import { getMongoDb } from '../../../db/mongoose.js';
import { readTwitterLiveData } from './reader.js';
import { computeAccountDiff } from './diff.service.js';

export async function registerParticipationRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /participation
   * Get current participation config
   */
  app.get('/participation', async (_req, reply) => {
    const config = getParticipationConfig();
    return reply.send({
      ok: true,
      data: config,
    });
  });
  
  /**
   * PATCH /participation
   * Update participation config
   */
  app.patch('/participation', async (req, reply) => {
    const updates = req.body as Partial<LiveParticipationConfig>;
    const updatedBy = 'admin';  // In real app, get from auth
    
    const config = updateParticipationConfig(updates, updatedBy);
    
    addAuditEvent({
      timestamp: new Date(),
      action: 'ENABLE',
      component: 'config',
      details: {
        triggered_by: updatedBy,
        reasons: ['Manual config update'],
      },
    });
    
    return reply.send({
      ok: true,
      data: config,
    });
  });
  
  /**
   * POST /participation/attempt
   * Try to enable a component (guarded)
   */
  app.post('/participation/attempt', async (req, reply) => {
    const { component, requested_weight } = req.body as {
      component: string;
      requested_weight: number;
    };
    
    if (!component || requested_weight === undefined) {
      return reply.status(400).send({
        ok: false,
        error: 'component and requested_weight required',
      });
    }
    
    // Get live metrics for this component
    const db = getMongoDb();
    const liveData = await readTwitterLiveData(db, { limit: 10 });
    
    // Calculate average metrics
    let avgConfidence = 75;
    let avgDataAge = 24;
    let hasSomeData = liveData.authors_count > 0;
    let mockValue = 500;
    let liveValue = 500;
    
    if (liveData.authors.length > 0) {
      avgDataAge = liveData.freshness.avg_age_hours;
      const diff = computeAccountDiff(
        liveData.authors[0],
        liveData.engagements,
        liveData.edges
      );
      mockValue = diff.scores.mock.twitter_score;
      liveValue = diff.scores.live.twitter_score;
      avgConfidence = diff.confidence.live * 100;
    }
    
    const metrics: ComponentMetrics = {
      mock_value: mockValue,
      live_value: liveValue,
      confidence: avgConfidence,
      data_age_hours: avgDataAge,
      spike_ratio: 1.0,
      has_data: hasSomeData,
    };
    
    const guardResult = checkGuards(component, requested_weight, metrics);
    
    // Log the attempt
    addAuditEvent({
      timestamp: new Date(),
      action: guardResult.decision === 'BLOCK' ? 'GUARD_BLOCK' : 
              guardResult.decision === 'DEGRADE' ? 'GUARD_DEGRADE' : 'ENABLE',
      component,
      details: {
        requested_weight,
        effective_weight: guardResult.effective_weight,
        decision: guardResult.decision,
        reasons: guardResult.reasons,
        triggered_by: 'admin',
      },
    });
    
    // If allowed or degraded, apply the change
    if (guardResult.decision !== 'BLOCK') {
      updateComponentParticipation(
        component as any,
        {
          enabled: true,
          weight: requested_weight,
          effective_weight: guardResult.effective_weight,
        },
        'admin'
      );
    }
    
    return reply.send({
      ok: guardResult.decision !== 'BLOCK',
      data: {
        decision: guardResult.decision,
        effective_weight: guardResult.effective_weight,
        reasons: guardResult.reasons,
        metrics: guardResult.metrics,
        applied: guardResult.decision !== 'BLOCK',
      },
    });
  });
  
  /**
   * POST /participation/preview
   * Preview blended metrics without applying
   */
  app.post('/participation/preview', async (req, reply) => {
    const { weights, account_id } = req.body as {
      weights?: {
        followers?: number;
        engagement?: number;
        graph_edges?: number;
        audience_quality?: number;
        authority?: number;
      };
      account_id?: string;
    };
    
    // Get live data
    const db = getMongoDb();
    const liveData = await readTwitterLiveData(db, { 
      author_ids: account_id ? [account_id] : undefined,
      limit: account_id ? 1 : 10 
    });
    
    // Generate mock and live metrics
    let mockMetrics = {
      twitter_score: 650,
      audience_quality: 0.72,
      authority: 0.65,
      smart_followers: 68,
    };
    
    let liveMetrics = {
      twitter_score: 620,
      audience_quality: 0.68,
      authority: 0.60,
      smart_followers: 55,
    };
    
    if (liveData.authors.length > 0) {
      const diff = computeAccountDiff(
        liveData.authors[0],
        liveData.engagements,
        liveData.edges
      );
      mockMetrics = diff.scores.mock;
      liveMetrics = diff.scores.live;
    }
    
    // Preview with requested weights
    const previewResult = weights 
      ? previewBlend(mockMetrics, liveMetrics, weights)
      : computeBlendedMetrics(mockMetrics, liveMetrics);
    
    const gradeChange = gradeChanged(
      previewResult.mock.twitter_score,
      previewResult.blended.twitter_score
    );
    
    return reply.send({
      ok: true,
      data: {
        mock_score: previewResult.mock.twitter_score,
        live_score: previewResult.live.twitter_score,
        blended_score: previewResult.blended.twitter_score,
        delta: previewResult.delta.twitter_score,
        grade_change: gradeChange.changed 
          ? `${gradeChange.from} → ${gradeChange.to}` 
          : `${gradeChange.from} (no change)`,
        weights: previewResult.weights,
        full_metrics: previewResult,
      },
    });
  });
  
  /**
   * POST /participation/rollback
   * Rollback component or all
   */
  app.post('/participation/rollback', async (req, reply) => {
    const { component, reason } = req.body as {
      component?: string;
      reason?: string;
    };
    
    const rollbackReason = reason || 'Manual rollback';
    
    if (component && component !== 'ALL') {
      rollbackComponent(component as any, rollbackReason);
      addAuditEvent({
        timestamp: new Date(),
        action: 'ROLLBACK',
        component,
        details: {
          reasons: [rollbackReason],
          triggered_by: 'admin',
        },
      });
    } else {
      killSwitch(rollbackReason, 'admin');
    }
    
    return reply.send({
      ok: true,
      data: {
        message: component ? `Rolled back ${component}` : 'Rolled back ALL components',
        config: getParticipationConfig(),
      },
    });
  });
  
  /**
   * POST /participation/monitor
   * Run monitor check (manual or cron)
   */
  app.post('/participation/monitor', async (req, reply) => {
    try {
      const db = getMongoDb();
      const liveData = await readTwitterLiveData(db, { limit: 20 });
      
      // Build metrics map
      const metricsMap = new Map<string, ComponentMetrics>();
      const config = getParticipationConfig();
      
      // For each enabled component, compute metrics
      const components = Object.keys(config.components) as Array<keyof typeof config.components>;
      for (const comp of components) {
        if (config.components[comp].enabled) {
          // Average metrics from live data
          let avgConfidence = 75;
          let avgAge = 24;
          
          if (liveData.authors.length > 0) {
            avgAge = liveData.freshness.avg_age_hours;
          }
          
          metricsMap.set(comp, {
            mock_value: 500,
            live_value: 520,
            confidence: avgConfidence,
            data_age_hours: avgAge,
            spike_ratio: 1.0,
            has_data: liveData.authors_count > 0,
          });
        }
      }
      
      const monitorResult = runMonitor(metricsMap);
      
      return reply.send({
        ok: true,
        data: {
          rollbacks: monitorResult.rollbacks,
          warnings: monitorResult.warnings,
          checked_components: metricsMap.size,
          config: getParticipationConfig(),
        },
      });
    } catch (err: any) {
      console.error('[Monitor] Error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /participation/audit
   * Get audit log
   */
  app.get('/participation/audit', async (req, reply) => {
    const { limit } = req.query as { limit?: string };
    const auditLimit = parseInt(limit || '50', 10);
    
    return reply.send({
      ok: true,
      data: getAuditLog(auditLimit),
    });
  });
  
  console.log('[LiveParticipation] Routes registered at /api/connections/twitter/live/participation/*');
}
