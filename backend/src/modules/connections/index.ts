/**
 * Connections Module - Main Entry Point
 * 
 * ═══════════════════════════════════════════════════════════════
 * PLUG-IN ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════
 * 
 * This module is designed as a self-contained plug-in that can be:
 * - Registered/unregistered without side effects
 * - Run standalone or integrated with host
 * - Configured independently
 * 
 * @example
 * // Register as plug-in
 * await registerConnectionsModule(app, {
 *   db: mongoDb,
 *   ports: { exchange: exchangePort, onchain: onchainPort },
 *   config: { enabled: true }
 * });
 * 
 * @example
 * // Legacy initialization (backward compatible)
 * await initConnectionsModule(app, db);
 * 
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE RULES
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. NO direct imports from host modules
 *    ❌ import { ExchangeService } from '../../exchange'
 *    ✅ import { IExchangePort } from './ports'
 * 
 * 2. ALL collections are namespaced with 'connections_' prefix
 *    connections_actors, connections_events, connections_clusters...
 * 
 * 3. ALL external data accessed through Ports only
 *    exchange.port.ts, onchain.port.ts, sentiment.port.ts, price.port.ts
 * 
 * 4. Module manages its own lifecycle
 *    Jobs, routes, and adapters registered internally
 * 
 * ═══════════════════════════════════════════════════════════════
 * WHAT'S INSIDE
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. Twitter Logic
 *    - Parser client
 *    - Score engine
 *    - Graph builder
 *    - Cluster detection
 *    - Narrative engine
 *    - Audience quality
 * 
 * 2. IPS Layer (Influencer Prediction System)
 *    - Event capture
 *    - Time windows
 *    - Outcome builder
 *    - Probability engine
 * 
 * 3. Taxonomy
 *    - Groups
 *    - Presets
 *    - Memberships
 * 
 * 4. Reality Layer
 *    - Verdict calculation
 *    - Credibility
 *    - Trust multiplier
 * 
 * 5. Alt Pattern Logic
 *    - Pattern registry
 *    - Alt scoring
 *    - Pattern similarity engine
 * 
 * ═══════════════════════════════════════════════════════════════
 */

// ============================================
// PLUG-IN API (RECOMMENDED)
// ============================================
export {
  registerConnectionsModule,
  unregisterConnectionsModule,
  getConnectionsDb,
  getConnectionsPorts,
  isConnectionsModuleInitialized,
} from './module.js';

// Types
export type {
  RegisterConnectionsModuleOptions,
  ConnectionsModuleConfig,
  IConnectionsPorts,
  IExchangePort,
  IOnchainPort,
  ISentimentPort,
  IPricePort,
} from './module.js';

// Config
export {
  getConnectionsConfig,
  updateConnectionsConfig,
  resetConnectionsConfig,
  COLLECTIONS,
  defaultConnectionsConfig,
} from './config/connections.config.js';

// Ports
export {
  nullPorts,
  nullExchangePort,
  nullOnchainPort,
  nullSentimentPort,
  nullPricePort,
} from './ports/index.js';

// ============================================
// LEGACY API (BACKWARD COMPATIBLE)
// ============================================
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
// Use internal job instead of external
import { startFollowGraphJob } from './jobs/follow-graph.job.js';

/**
 * Legacy initialization function
 * @deprecated Use registerConnectionsModule() instead
 */
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
      
      // Register Time Series routes
      await instance.register(registerTimeseriesRoutes, { prefix: '/timeseries' });
      
      // Register Twitter Live routes
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

  // Register Alert Policy Admin routes
  await app.register(
    async (instance) => {
      await registerAlertPolicyRoutes(instance);
    },
    { prefix: '/api/admin/connections/alerts/policy' }
  );

  // Register Pilot Admin routes
  await app.register(
    async (instance) => {
      await registerPilotRoutes(instance);
    },
    { prefix: '/api/admin/connections/pilot' }
  );

  // Register Simulation routes
  await app.register(
    async (instance) => {
      await registerSimulationRoutes(instance);
    },
    { prefix: '/api/admin/connections/simulation' }
  );

  // Register ML routes
  await app.register(
    async (instance) => {
      await registerMLRoutes(instance);
    },
    { prefix: '/api/connections/ml' }
  );

  // Register ML Admin routes
  await app.register(
    async (instance) => {
      await registerAdminMLRoutes(instance);
    },
    { prefix: '/api/admin/connections/ml' }
  );

  // Register Drift routes
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

  // Start Follow Graph auto-parse job
  startFollowGraphJob(30);

  // Register Twitter Adapter Admin routes
  await app.register(
    async (instance) => {
      const { registerTwitterAdapterAdminRoutes } = await import('./admin/twitter-adapter-admin.routes.js');
      await registerTwitterAdapterAdminRoutes(instance);
    },
    { prefix: '/api/admin/connections/twitter-adapter' }
  );

  // Initialize DB-dependent modules
  if (db) {
    await initMicroFreezeModule(db, app);
    await initT26Module(db, app);
    await initNetworkV2Module(db, app);
  }

  console.log('[Connections] Module initialized (legacy mode)');
}

// Export core function for aggregation layer
export { processTwitterPostForConnections } from './core/index.js';
export { connectionsAdminConfig, updateConnectionsConfig as updateLegacyConfig } from './admin/connections-admin.js';
export type { AuthorProfile } from './core/scoring/compute-influence-score.js';
