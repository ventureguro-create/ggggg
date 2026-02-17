/**
 * Admin T2.4 Expansion Routes
 * 
 * Control and monitoring for T2.4 network & alerts expansion.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { getExpansionConfig, updateExpansionConfig, rollbackToBaseline, shouldAutoRollback } from '../../connections/network/network-expansion.config.js';
import { updateNetworkConfig, getNetworkConfig, buildNetworkGraph } from '../../connections/network/network-adapter.service.js';
import { enrichAlerts } from '../../alerts/alert-enrichment.service.js';
import { bridgeSignals } from '../../connections/adapters/twitter/alert-bridge.service.js';
import { calculateCurrentAQM, checkAQMHealth, initAQMMonitor } from '../../alerts/monitoring/aqm-monitor.service.js';
import { getShadowStats, initML2ShadowMonitor } from '../../alerts/monitoring/ml2-shadow.monitor.js';
import { calculateDrift, getDriftStatus, checkAndRollback } from '../../alerts/monitoring/drift-watch.service.js';

let monitorsInitialized = false;

async function ensureMonitorsInit() {
  if (!monitorsInitialized) {
    const db = getMongoDb();
    initAQMMonitor(db);
    initML2ShadowMonitor(db);
    monitorsInitialized = true;
  }
}

export async function registerT24ExpansionRoutes(app: FastifyInstance) {
  await ensureMonitorsInit();

  // GET /status - Full T2.4 expansion status
  app.get('/status', async () => {
    const db = getMongoDb();
    const expansionConfig = getExpansionConfig();
    const networkConfig = getNetworkConfig();
    const driftStatus = getDriftStatus();
    const aqm = await calculateCurrentAQM(db);
    const aqmHealth = checkAQMHealth(aqm);
    const ml2Stats = await getShadowStats();
    const graph = await buildNetworkGraph(db);

    return {
      ok: true,
      data: {
        version: 'T2.4',
        expansion: {
          config: expansionConfig,
          network_weight: networkConfig.weight_cap,
          pilot_only: expansionConfig.network_weight_pilot_only,
        },
        drift: driftStatus,
        aqm: {
          metrics: aqm,
          health: aqmHealth,
        },
        ml2_shadow: ml2Stats,
        network: {
          edges_count: graph.stats.total_edges,
          co_engagement_edges: graph.stats.co_engagement_edges,
          avg_weight: graph.stats.avg_weight,
        },
        safety: {
          auto_rollback_enabled: expansionConfig.auto_rollback_enabled,
          last_rollback_triggered: driftStatus.auto_rollback_triggered,
        },
      },
    };
  });

  // PATCH /network-weight - Adjust network weight (max 20%)
  app.patch('/network-weight', async (req: FastifyRequest) => {
    const { weight } = req.body as { weight: number };
    
    if (weight > 0.20) {
      return { ok: false, error: 'Max weight in T2.4 is 20%' };
    }
    
    updateExpansionConfig({ network_weight_cap: weight });
    updateNetworkConfig({ weight_cap: weight });
    
    console.log(`[T2.4] Network weight set to ${(weight * 100).toFixed(0)}%`);
    return { ok: true, data: { weight } };
  });

  // POST /check-drift - Force drift check
  app.post('/check-drift', async () => {
    const db = getMongoDb();
    const result = await checkAndRollback(db);
    return { ok: true, data: result };
  });

  // POST /test-enriched - Test enriched alerts
  app.post('/test-enriched', async () => {
    const db = getMongoDb();
    const { candidates } = await bridgeSignals(db);
    const enriched = await enrichAlerts(db, candidates.slice(0, 10));
    
    return {
      ok: true,
      data: {
        total: enriched.length,
        sample: enriched.slice(0, 5).map(e => ({
          account: e.account_id,
          signal: e.signal_type,
          confidence: (e.confidence * 100).toFixed(0) + '%',
          flags: e.flags,
          network_score: e.enrichment?.network_score 
            ? (e.enrichment.network_score * 100).toFixed(0) + '%' 
            : 'N/A',
          cluster: e.enrichment?.cluster_type,
        })),
      },
    };
  });

  // POST /rollback - Manual rollback to baseline
  app.post('/rollback', async () => {
    const config = rollbackToBaseline();
    updateNetworkConfig({ weight_cap: 0.15 });
    console.log('[T2.4] Manual rollback to baseline');
    return { ok: true, data: config, message: 'Rolled back to 15% baseline' };
  });

  // GET /aqm - Current AQM metrics
  app.get('/aqm', async () => {
    const db = getMongoDb();
    const aqm = await calculateCurrentAQM(db);
    const health = checkAQMHealth(aqm);
    return { ok: true, data: { metrics: aqm, health } };
  });

  // GET /ml2-shadow - ML2 shadow stats
  app.get('/ml2-shadow', async () => {
    const stats = await getShadowStats();
    return { ok: true, data: stats };
  });

  // PATCH /config - Update expansion config
  app.patch('/config', async (req: FastifyRequest) => {
    const updates = req.body as any;
    const config = updateExpansionConfig(updates);
    return { ok: true, data: config };
  });

  console.log('[T2.4] Expansion routes registered at /api/admin/t24/*');
}
