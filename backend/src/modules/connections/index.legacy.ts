/**
 * Connections Module - Main Entry
 * 
 * Provides:
 * - Author/Influencer profiling
 * - Influence scoring (v0)
 * - Risk detection
 * - Time Series Analytics (Phase 2.1)
 * - Twitter Live Preview (Phase 4.2)
 * - Alert Policy Engine (Phase 4.5)
 * - Pilot Rollout (Phase 4.6)
 * 
 * Does NOT:
 * - Touch Twitter Parser
 * - Touch Sentiment
 * - Modify TwitterPost contract
 */

import type { FastifyInstance } from 'fastify';
import { registerConnectionsRoutes } from './api/routes.js';
import { registerGraphStateRoutes } from './share/graph-state.routes.js';
import { connectionsAdminConfig } from './admin/connections-admin.js';
import { registerTimeseriesRoutes, registerTimeseriesAdminRoutes } from './timeseries/index.js';
import { registerTwitterLiveRoutes } from './twitter-live/index.js';
import { registerAlertPolicyRoutes } from './core/alerts/alert-policy.routes.js';
import { registerPilotRoutes } from './core/pilot/pilot.routes.js';
import { registerSimulationRoutes } from './simulation/simulation.routes.js';
import { registerMLRoutes, registerAdminMLRoutes } from './ml/ml.routes.js';
import { registerDriftRoutes } from './drift/index.js';
import { initMicroFreezeModule } from './freeze/index.js';
import { initT26Module } from './t26/index.js';
import { initNetworkV2Module } from './network-v2/index.js';
import { tokenMomentumRoutes } from './token-momentum/index.js';
import { startFollowGraphJob } from '../../jobs/follow_graph.job.js';

export async function initConnectionsModule(app: FastifyInstance, db?: any): Promise<void> {
  if (!connectionsAdminConfig.enabled) {
    console.log('[Connections] Module DISABLED via config');
    return;
  }

  // Register API routes with prefix
  await app.register(
    async (instance) => {
      await registerConnectionsRoutes(instance);
      registerGraphStateRoutes(instance);
      
      // Register Time Series routes (Phase 2.1)
      await instance.register(registerTimeseriesRoutes, { prefix: '/timeseries' });
      
      // Register Twitter Live routes (Phase 4.2)
      await instance.register(
        async (liveInstance) => {
          await registerTwitterLiveRoutes(liveInstance);
        },
        { prefix: '/twitter/live' }
      );
    },
    { prefix: '/api/connections' }
  );
  
  // Register Time Series Admin routes
  await app.register(
    async (instance) => {
      await registerTimeseriesAdminRoutes(instance);
    },
    { prefix: '/api/admin/connections/timeseries' }
  );

  // Register Alert Policy Admin routes (Phase 4.5)
  await app.register(
    async (instance) => {
      await registerAlertPolicyRoutes(instance);
    },
    { prefix: '/api/admin/connections/alerts/policy' }
  );

  // Register Pilot Admin routes (Phase 4.6)
  await app.register(
    async (instance) => {
      await registerPilotRoutes(instance);
    },
    { prefix: '/api/admin/connections/pilot' }
  );

  // Register Simulation routes (Phase 4.7)
  await app.register(
    async (instance) => {
      await registerSimulationRoutes(instance);
    },
    { prefix: '/api/admin/connections/simulation' }
  );

  // Register ML routes (Phase 5.1 + 5.2)
  await app.register(
    async (instance) => {
      await registerMLRoutes(instance);
    },
    { prefix: '/api/connections/ml' }
  );

  // Register ML Admin routes (Phase 5.1 + 5.2)
  await app.register(
    async (instance) => {
      await registerAdminMLRoutes(instance);
    },
    { prefix: '/api/admin/connections/ml' }
  );

  // Register Drift routes (Phase 6.0)
  await app.register(
    async (instance) => {
      await registerDriftRoutes(instance);
    },
    { prefix: '/api/connections/drift' }
  );

  // Register Token Momentum routes
  await app.register(
    async (instance) => {
      await tokenMomentumRoutes(instance);
    }
  );

  // Start Follow Graph auto-parse job (30 minutes interval)
  startFollowGraphJob(30);

  // Register Twitter Adapter Admin routes (Phase T2.1)
  await app.register(
    async (instance) => {
      const { registerTwitterAdapterAdminRoutes } = await import('./admin/twitter-adapter-admin.routes.js');
      await registerTwitterAdapterAdminRoutes(instance);
    },
    { prefix: '/api/admin/connections/twitter-adapter' }
  );

  // Initialize Micro-Freeze module (T2.5)
  if (db) {
    await initMicroFreezeModule(db, app);
    console.log('[Connections] Micro-Freeze API available at /api/admin/connections/freeze/*');
    
    // Initialize T2.6 module
    await initT26Module(db, app);
    console.log('[Connections] T2.6 API available at /api/admin/connections/t26/*');
    
    // Initialize Network v2 module
    await initNetworkV2Module(db, app);
    console.log('[Connections] Network v2 API available at /api/admin/connections/network-v2/*');
  }


  console.log('[Connections] Module initialized');
  console.log('[Connections] API available at /api/connections/*');
  console.log('[Connections] Time Series API available at /api/connections/timeseries/*');
  console.log('[Connections] Twitter Live API available at /api/connections/twitter/live/*');
  console.log('[Connections] Alert Policy API available at /api/admin/connections/alerts/policy/*');
  console.log('[Connections] Pilot API available at /api/admin/connections/pilot/*');
  console.log('[Connections] Simulation API available at /api/admin/connections/simulation/*');
  console.log('[Connections] ML API available at /api/connections/ml/* and /api/admin/connections/ml/*');
  console.log('[Connections] Drift API available at /api/connections/drift/*');
  console.log('[Connections] Token Momentum API available at /api/connections/momentum/*');
  console.log('[Connections] Follow Graph auto-parse job started (30 min interval)');
}

// Export core function for aggregation layer
export { processTwitterPostForConnections } from './core/index.js';
export { connectionsAdminConfig, updateConnectionsConfig } from './admin/connections-admin.js';
export type { AuthorProfile } from './core/scoring/compute-influence-score.js';
