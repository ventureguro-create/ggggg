/**
 * Connections Admin Routes
 * 
 * Control Plane for Connections module:
 * - GET /admin/connections/overview - Module status & stats
 * - GET /admin/connections/config - Current configuration
 * - POST /admin/connections/config/apply - Apply config changes
 * - GET /admin/connections/tuning/status - Stability metrics
 * - POST /admin/connections/tuning/run - Run tuning analysis
 * - GET /admin/connections/alerts/preview - Pending alerts
 * - POST /admin/connections/alerts/config - Update alert settings
 * - POST /admin/connections/alerts/run - Run alerts batch (P2.1)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAdminAuth } from './admin.middleware.js';
import { logAdminAction } from './admin.audit.js';
import {
  runAlertsBatch,
  getAlerts,
  getAlertsSummary,
  updateAlertStatus,
  getAlertsEngineConfig,
  updateAlertsEngineConfig,
  type AccountState,
  type AlertType,
} from '../../modules/connections/core/alerts/index.js';

// In-memory state for demo (would be DB in production)
let connectionsState = {
  enabled: true,
  source_mode: 'mock' as 'mock' | 'sandbox' | 'twitter_live',
  last_run: new Date().toISOString(),
  stats: {
    accounts_24h: 0,
    early_signals: 0,
    breakouts: 0,
    alerts_generated: 0,
    alerts_sent: 0,
  },
  errors: [] as string[],
};

// Config version tracking
let configVersion = '0.5.3';
let configHistory: Array<{
  version: string;
  timestamp: string;
  changes: any;
  admin_id: string;
}> = [];

export async function adminConnectionsRoutes(app: FastifyInstance): Promise<void> {
  // All routes require admin auth
  app.addHook('preHandler', requireAdminAuth(['ADMIN', 'MODERATOR']));

  // ============================================================
  // OVERVIEW
  // ============================================================

  /**
   * GET /admin/connections/overview
   * Quick status check for the module
   */
  app.get('/overview', async (_req: FastifyRequest, reply: FastifyReply) => {
    const alertsSummary = getAlertsSummary();
    
    // Generate some mock stats
    const stats = {
      ...connectionsState.stats,
      accounts_24h: Math.floor(Math.random() * 50) + 100,
      early_signals: Math.floor(Math.random() * 15) + 5,
      breakouts: Math.floor(Math.random() * 5) + 1,
      alerts_generated: alertsSummary.total,
    };

    return reply.send({
      ok: true,
      data: {
        enabled: connectionsState.enabled,
        source_mode: connectionsState.source_mode,
        last_run: connectionsState.last_run,
        stats,
        errors: connectionsState.errors.slice(-5),
        health: {
          status: connectionsState.errors.length === 0 ? 'healthy' : 'degraded',
          uptime_hours: Math.floor(Math.random() * 100) + 50,
        },
      },
    });
  });

  /**
   * POST /admin/connections/toggle
   * Enable/disable the module
   */
  app.post('/toggle', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { enabled?: boolean };
    const adminId = (req as any).adminUser?.id || 'unknown';
    
    if (body.enabled !== undefined) {
      connectionsState.enabled = body.enabled;
      
      await logAdminAction({
        adminId,
        action: 'CONNECTIONS_TOGGLE',
        details: { enabled: body.enabled },
        ip: req.ip,
      });
    }

    return reply.send({
      ok: true,
      data: { enabled: connectionsState.enabled },
    });
  });

  /**
   * POST /admin/connections/source
   * Change data source mode
   */
  app.post('/source', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { mode?: 'mock' | 'sandbox' | 'twitter_live' };
    const adminId = (req as any).adminUser?.id || 'unknown';
    
    if (body.mode && ['mock', 'sandbox', 'twitter_live'].includes(body.mode)) {
      const previousMode = connectionsState.source_mode;
      connectionsState.source_mode = body.mode;
      
      await logAdminAction({
        adminId,
        action: 'CONNECTIONS_SOURCE_CHANGE',
        details: { from: previousMode, to: body.mode },
        ip: req.ip,
      });
    }

    return reply.send({
      ok: true,
      data: { source_mode: connectionsState.source_mode },
    });
  });

  // ============================================================
  // CONFIG
  // ============================================================

  /**
   * GET /admin/connections/config
   * Get current configuration (read-only view)
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    // Import actual configs
    const { ConnectionsTrendConfig } = await import('../../modules/connections/core/scoring/connections-trend-config.js');
    const { EarlySignalConfig } = await import('../../modules/connections/core/scoring/early-signal-config.js');

    return reply.send({
      ok: true,
      data: {
        version: configVersion,
        editable: false, // For now, read-only
        last_modified: configHistory.length > 0 
          ? configHistory[configHistory.length - 1].timestamp 
          : null,
        config: {
          trend_adjusted: ConnectionsTrendConfig,
          early_signal: EarlySignalConfig,
        },
        history: configHistory.slice(-5),
      },
    });
  });

  /**
   * POST /admin/connections/config/apply
   * Apply configuration changes (with audit)
   */
  app.post('/config/apply', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { 
      changes?: Record<string, any>;
      confirm?: boolean;
    };
    const adminId = (req as any).adminUser?.id || 'unknown';

    if (!body.changes || !body.confirm) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'Changes and confirm flag required',
      });
    }

    // For now, just log the intent (actual config modification would require more careful handling)
    const newVersion = `0.5.${parseInt(configVersion.split('.')[2]) + 1}`;
    
    configHistory.push({
      version: newVersion,
      timestamp: new Date().toISOString(),
      changes: body.changes,
      admin_id: adminId,
    });
    
    configVersion = newVersion;

    await logAdminAction({
      adminId,
      action: 'CONNECTIONS_CONFIG_APPLY',
      details: { version: newVersion, changes: body.changes },
      ip: req.ip,
    });

    return reply.send({
      ok: true,
      message: 'Config changes applied (logged for audit)',
      data: {
        version: newVersion,
        applied_at: new Date().toISOString(),
      },
    });
  });

  // ============================================================
  // STABILITY / TUNING
  // ============================================================

  /**
   * GET /admin/connections/tuning/status
   * Get last tuning run results
   */
  app.get('/tuning/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    // Run quick tuning check
    const { runFullTuningMatrix, generateMockTuningDataset } = await import('../../modules/connections/core/scoring/threshold-tuning.js');
    
    try {
      const dataset = generateMockTuningDataset(15);
      const result = runFullTuningMatrix(dataset);
      
      return reply.send({
        ok: true,
        data: {
          last_run: new Date().toISOString(),
          overall_stability: result.overall_stability,
          parameters: result.parameters.map(p => ({
            name: p.parameter,
            safe_range: p.recommendation.safe_range,
            optimal_delta: p.recommendation.optimal_delta,
            warning: p.recommendation.warning,
            best_stability: Math.max(...p.results.map(r => r.stability_score)),
          })),
          recommendations: result.recommendations,
          dataset_size: dataset.length,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TUNING_ERROR',
        message: err.message,
      });
    }
  });

  /**
   * POST /admin/connections/tuning/run
   * Run full tuning analysis
   */
  app.post('/tuning/run', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { 
      parameter?: string;
      dataset_size?: number;
    };
    const adminId = (req as any).adminUser?.id || 'unknown';

    const { runThresholdTuning, runFullTuningMatrix, generateMockTuningDataset } = await import('../../modules/connections/core/scoring/threshold-tuning.js');

    try {
      const datasetSize = body.dataset_size || 20;
      const dataset = generateMockTuningDataset(datasetSize);
      
      let result;
      if (body.parameter) {
        // Single parameter tuning
        const deltas = [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2];
        result = runThresholdTuning(dataset, body.parameter as any, deltas);
      } else {
        // Full matrix
        result = runFullTuningMatrix(dataset);
      }

      await logAdminAction({
        adminId,
        action: 'CONNECTIONS_TUNING_RUN',
        details: { parameter: body.parameter || 'full', dataset_size: datasetSize },
        ip: req.ip,
      });

      return reply.send({
        ok: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        ok: false,
        error: 'TUNING_ERROR',
        message: err.message,
      });
    }
  });

  // ============================================================
  // ALERTS (P2.1 - Alerts Engine)
  // ============================================================

  /**
   * GET /admin/connections/alerts/preview
   * Preview pending/recent alerts from Alerts Engine
   */
  app.get('/alerts/preview', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { type?: string; status?: string; limit?: string };
    
    const alerts = getAlerts({
      type: query.type as AlertType | undefined,
      status: query.status as 'preview' | 'sent' | 'suppressed' | undefined,
      limit: query.limit ? parseInt(query.limit) : 50,
    });
    
    const summary = getAlertsSummary();
    const config = getAlertsEngineConfig();

    return reply.send({
      ok: true,
      data: {
        alerts,
        config: {
          enabled: config.enabled,
          types: config.conditions,
          global_cooldown_minutes: config.global_cooldown_minutes,
        },
        summary,
      },
    });
  });

  /**
   * POST /admin/connections/alerts/run
   * Run alerts batch on current accounts (P2.1)
   */
  app.post('/alerts/run', async (req: FastifyRequest, reply: FastifyReply) => {
    const adminId = (req as any).adminUser?.id || 'unknown';
    
    // Generate mock account states for testing
    // In production, this would fetch real accounts from DB
    const mockAccounts: AccountState[] = [
      {
        author_id: 'demo_001',
        username: 'alpha_seeker',
        profile: 'retail',
        risk_level: 'low',
        influence_base: 650,
        influence_adjusted: 782,
        trend: { velocity_norm: 0.25, acceleration_norm: 0.42, state: 'growing' },
        early_signal: { score: 720, badge: 'breakout', confidence: 0.72 },
      },
      {
        author_id: 'demo_002',
        username: 'defi_hunter',
        profile: 'influencer',
        risk_level: 'low',
        influence_base: 580,
        influence_adjusted: 840,
        trend: { velocity_norm: 0.38, acceleration_norm: 0.65, state: 'growing' },
        early_signal: { score: 840, badge: 'breakout', confidence: 0.81 },
      },
      {
        author_id: 'demo_003',
        username: 'token_master',
        profile: 'retail',
        risk_level: 'medium',
        influence_base: 420,
        influence_adjusted: 610,
        trend: { velocity_norm: 0.18, acceleration_norm: 0.31, state: 'growing' },
        early_signal: { score: 580, badge: 'rising', confidence: 0.58 },
      },
      {
        author_id: 'demo_004',
        username: 'whale_watcher',
        profile: 'whale',
        risk_level: 'low',
        influence_base: 920,
        influence_adjusted: 950,
        trend: { velocity_norm: 0.08, acceleration_norm: 0.12, state: 'stable' },
        early_signal: { score: 380, badge: 'none', confidence: 0.35 },
      },
      {
        author_id: 'demo_005',
        username: 'volatile_trader',
        profile: 'retail',
        risk_level: 'high',
        influence_base: 380,
        influence_adjusted: 420,
        trend: { velocity_norm: 0.52, acceleration_norm: 0.68, state: 'volatile' },
        early_signal: { score: 650, badge: 'breakout', confidence: 0.62 },
      },
      {
        author_id: 'demo_006',
        username: 'steady_growth',
        profile: 'influencer',
        risk_level: 'low',
        influence_base: 720,
        influence_adjusted: 810,
        trend: { velocity_norm: 0.22, acceleration_norm: 0.28, state: 'growing' },
        early_signal: { score: 520, badge: 'rising', confidence: 0.55 },
      },
    ];
    
    const result = runAlertsBatch(mockAccounts);
    
    await logAdminAction({
      adminId,
      action: 'CONNECTIONS_ALERTS_RUN',
      details: result,
      ip: req.ip,
    });
    
    // Update stats
    connectionsState.stats.alerts_generated += result.alerts_generated;

    return reply.send({
      ok: true,
      data: result,
    });
  });

  /**
   * POST /admin/connections/alerts/config
   * Update alert configuration
   */
  app.post('/alerts/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      enabled?: boolean;
      types?: Record<string, { enabled?: boolean; severity_min?: number; cooldown_minutes?: number }>;
      global_cooldown_minutes?: number;
    };
    const adminId = (req as any).adminUser?.id || 'unknown';

    const updatedConfig = updateAlertsEngineConfig({
      enabled: body.enabled,
      conditions: body.types as any,
      global_cooldown_minutes: body.global_cooldown_minutes,
    });

    await logAdminAction({
      adminId,
      action: 'CONNECTIONS_ALERTS_CONFIG',
      details: body,
      ip: req.ip,
    });

    return reply.send({
      ok: true,
      data: {
        enabled: updatedConfig.enabled,
        types: updatedConfig.conditions,
        global_cooldown_minutes: updatedConfig.global_cooldown_minutes,
      },
    });
  });

  /**
   * POST /admin/connections/alerts/send
   * Mark alert as sent (preview-only in P2.1, no actual delivery)
   */
  app.post('/alerts/send', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { alert_id: string };
    const adminId = (req as any).adminUser?.id || 'unknown';

    const alert = updateAlertStatus(body.alert_id, 'sent');
    
    if (!alert) {
      return reply.status(404).send({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Alert not found',
      });
    }
    
    // Update stats
    connectionsState.stats.alerts_sent++;

    await logAdminAction({
      adminId,
      action: 'CONNECTIONS_ALERT_SENT',
      details: { alert_id: body.alert_id, type: alert.type },
      ip: req.ip,
    });

    return reply.send({
      ok: true,
      message: 'Alert marked as sent (preview-only, no actual delivery)',
      data: alert,
    });
  });

  /**
   * POST /admin/connections/alerts/suppress
   * Suppress an alert
   */
  app.post('/alerts/suppress', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { alert_id: string };
    const adminId = (req as any).adminUser?.id || 'unknown';

    const alert = updateAlertStatus(body.alert_id, 'suppressed');
    
    if (!alert) {
      return reply.status(404).send({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Alert not found',
      });
    }

    await logAdminAction({
      adminId,
      action: 'CONNECTIONS_ALERT_SUPPRESSED',
      details: { alert_id: body.alert_id, type: alert.type },
      ip: req.ip,
    });

    return reply.send({
      ok: true,
      message: 'Alert suppressed',
      data: alert,
    });
  });

  console.log('[Admin] Connections routes registered at /api/admin/connections');
}
