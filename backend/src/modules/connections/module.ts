/**
 * Connections Module - Plug-in Entry Point
 * 
 * Self-contained module that can be:
 * - Registered/unregistered without side effects
 * - Run standalone or integrated with host
 * - Configured independently
 * 
 * @example
 * // Register module
 * await registerConnectionsModule(app, {
 *   exchangePort,
 *   onchainPort,
 *   sentimentPort,
 *   pricePort,
 *   config: { enabled: true }
 * });
 * 
 * // Unregister module
 * await unregisterConnectionsModule(app);
 */

import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';
import { 
  IConnectionsPorts, 
  nullPorts,
  validatePorts,
  PORTS_VERSION,
} from './ports/index.js';
import { 
  ConnectionsModuleConfig, 
  defaultConnectionsConfig,
  getConnectionsConfig,
  updateConnectionsConfig,
  COLLECTIONS
} from './config/connections.config.js';

// ============================================
// MODULE STATE
// ============================================
interface ConnectionsModuleState {
  initialized: boolean;
  db: Db | null;
  ports: IConnectionsPorts;
  jobs: NodeJS.Timeout[];
  config: ConnectionsModuleConfig;
}

const moduleState: ConnectionsModuleState = {
  initialized: false,
  db: null,
  ports: nullPorts,
  jobs: [],
  config: defaultConnectionsConfig,
};

// ============================================
// REGISTRATION OPTIONS
// ============================================
export interface RegisterConnectionsModuleOptions {
  db?: Db;
  ports?: Partial<IConnectionsPorts>;
  config?: Partial<ConnectionsModuleConfig>;
}

// ============================================
// REGISTER MODULE
// ============================================
export async function registerConnectionsModule(
  app: FastifyInstance,
  options: RegisterConnectionsModuleOptions = {}
): Promise<void> {
  // Prevent double registration
  if (moduleState.initialized) {
    console.warn('[Connections] Module already initialized, skipping');
    return;
  }

  // Apply config
  if (options.config) {
    updateConnectionsConfig(options.config);
  }
  
  const config = getConnectionsConfig();
  
  // Check if enabled
  if (!config.enabled) {
    console.log('[Connections] Module DISABLED via config');
    return;
  }

  // Store DB reference
  moduleState.db = options.db || null;
  if (!moduleState.db) {
    console.warn('[Connections] No database provided, some features will be limited');
  }
  
  // Validate and setup ports with runtime guards
  console.log(`[Connections] Validating ports (version ${PORTS_VERSION})...`);
  moduleState.ports = validatePorts(options.ports);
  
  // Log port status
  logPortStatus(moduleState.ports);

  console.log('[Connections] Registering module...');
  
  // Register all routes
  await registerRoutes(app);
  
  // Start jobs (only if DB available)
  if (moduleState.db) {
    startJobs();
  } else {
    console.warn('[Connections] Jobs not started - no database connection');
  }
  
  // Mark as initialized
  moduleState.initialized = true;
  moduleState.config = config;
  
  console.log('[Connections] ✅ Module registered successfully');
  console.log('[Connections] API: /api/connections/*');
  console.log('[Connections] Admin: /api/admin/connections/*');
}

/**
 * Log port configuration status
 */
function logPortStatus(ports: IConnectionsPorts): void {
  const portNames = ['exchange', 'onchain', 'sentiment', 'price', 'telegram', 'twitterParser'] as const;
  
  for (const name of portNames) {
    const port = ports[name as keyof IConnectionsPorts];
    if (port) {
      const isNull = port === (nullPorts as any)[name];
      const status = isNull ? '⚠️ NULL' : '✅ ACTIVE';
      console.log(`[Connections] Port ${name}: ${status} (v${(port as any).version || 'unknown'})`);
    }
  }
}

// ============================================
// UNREGISTER MODULE
// ============================================
export async function unregisterConnectionsModule(app: FastifyInstance): Promise<void> {
  if (!moduleState.initialized) {
    console.warn('[Connections] Module not initialized, nothing to unregister');
    return;
  }

  console.log('[Connections] Unregistering module...');
  
  // Stop all jobs
  stopJobs();
  
  // Reset state
  moduleState.initialized = false;
  moduleState.db = null;
  moduleState.ports = nullPorts;
  moduleState.config = defaultConnectionsConfig;
  
  console.log('[Connections] ✅ Module unregistered successfully');
}

// ============================================
// ROUTE REGISTRATION
// ============================================
async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Import route registrars dynamically to avoid circular deps
  const { registerConnectionsRoutes } = await import('./api/routes.js');
  const { registerGraphStateRoutes } = await import('./share/graph-state.routes.js');
  const { registerTimeseriesRoutes, registerTimeseriesAdminRoutes } = await import('./timeseries/index.js');
  const { registerTwitterLiveRoutes } = await import('./twitter-live/index.js');
  const { registerAlertPolicyRoutes } = await import('./core/alerts/alert-policy.routes.js');
  const { registerMLRoutes, registerAdminMLRoutes } = await import('./ml/ml.routes.js');
  const { registerDriftRoutes } = await import('./drift/index.js');
  const { tokenMomentumRoutes } = await import('./token-momentum/index.js');
  
  // Main API routes
  await app.register(
    async (instance) => {
      await registerConnectionsRoutes(instance);
      registerGraphStateRoutes(instance);
      
      // Timeseries
      await instance.register(registerTimeseriesRoutes, { prefix: '/timeseries' });
      
      // Twitter Live
      await instance.register(
        async (liveInstance) => {
          await registerTwitterLiveRoutes(liveInstance);
        },
        { prefix: '/twitter/live' }
      );
      
      // ML
      await instance.register(registerMLRoutes);
      
      // Drift
      await instance.register(registerDriftRoutes, { prefix: '/drift' });
      
      // Token Momentum
      await instance.register(tokenMomentumRoutes);
    },
    { prefix: '/api/connections' }
  );
  
  // Admin routes
  await app.register(
    async (instance) => {
      await registerTimeseriesAdminRoutes(instance);
    },
    { prefix: '/api/admin/connections/timeseries' }
  );
  
  await app.register(
    async (instance) => {
      await registerAlertPolicyRoutes(instance);
    },
    { prefix: '/api/admin/connections/alerts/policy' }
  );
  
  await app.register(
    async (instance) => {
      await registerAdminMLRoutes(instance);
    },
    { prefix: '/api/admin/connections/ml' }
  );
  
  // Register blocks-15-28 routes (Farm Network, Clusters, etc.)
  try {
    const { registerBlocks1528Routes } = await import('./blocks-15-28/index.js');
    await app.register(
      async (instance) => {
        await registerBlocks1528Routes(instance);
      },
      { prefix: '/api/connections' }
    );
  } catch (err) {
    console.warn('[Connections] blocks-15-28 routes not available:', err);
  }
  
  // Register unified routes
  try {
    const { registerUnifiedRoutes } = await import('./unified/index.js');
    await app.register(
      async (instance) => {
        await registerUnifiedRoutes(instance);
      },
      { prefix: '/api/connections' }
    );
  } catch (err) {
    console.warn('[Connections] unified routes not available:', err);
  }
  
  // Register network routes
  try {
    const { registerNetworkRoutes } = await import('./network/network.routes.js');
    await app.register(
      async (instance) => {
        await registerNetworkRoutes(instance);
      },
      { prefix: '/api/connections/network' }
    );
  } catch (err) {
    console.warn('[Connections] network routes not available:', err);
  }
  
  // Register cluster-attention routes
  try {
    const { registerClusterRoutes } = await import('./cluster-attention/index.js');
    await app.register(
      async (instance) => {
        await registerClusterRoutes(instance);
      },
      { prefix: '/api/connections' }
    );
  } catch (err) {
    console.warn('[Connections] cluster-attention routes not available:', err);
  }
}

// ============================================
// JOB MANAGEMENT
// ============================================
function startJobs(): void {
  const config = getConnectionsConfig();
  
  // Follow Graph Job
  if (config.twitter.parserEnabled) {
    const followGraphJob = setInterval(async () => {
      try {
        const { runFollowGraphCycle } = await import('./jobs/follow-graph.job.js');
        await runFollowGraphCycle();
      } catch (err) {
        console.error('[Connections] Follow graph job error:', err);
      }
    }, config.jobs.followGraphIntervalMinutes * 60 * 1000);
    moduleState.jobs.push(followGraphJob);
    console.log(`[Connections] Started follow-graph job (${config.jobs.followGraphIntervalMinutes}min)`);
  }
  
  // Cluster Detection Job
  if (config.features.clusterAttention) {
    const clusterJob = setInterval(async () => {
      try {
        const { runClusterDetection } = await import('./jobs/cluster-detection.job.js');
        await runClusterDetection();
      } catch (err) {
        console.error('[Connections] Cluster detection job error:', err);
      }
    }, config.jobs.clusterDetectionIntervalMinutes * 60 * 1000);
    moduleState.jobs.push(clusterJob);
    console.log(`[Connections] Started cluster-detection job (${config.jobs.clusterDetectionIntervalMinutes}min)`);
  }
  
  // Audience Quality Job
  if (config.features.farmDetection) {
    const audienceJob = setInterval(async () => {
      try {
        const { runAudienceQualityCheck } = await import('./jobs/audience-quality.job.js');
        await runAudienceQualityCheck();
      } catch (err) {
        console.error('[Connections] Audience quality job error:', err);
      }
    }, config.jobs.audienceQualityIntervalMinutes * 60 * 1000);
    moduleState.jobs.push(audienceJob);
    console.log(`[Connections] Started audience-quality job (${config.jobs.audienceQualityIntervalMinutes}min)`);
  }
}

function stopJobs(): void {
  for (const job of moduleState.jobs) {
    clearInterval(job);
  }
  moduleState.jobs = [];
  console.log('[Connections] All jobs stopped');
}

// ============================================
// MODULE ACCESSORS
// ============================================

/**
 * Get database reference (for internal use only)
 */
export function getConnectionsDb(): Db | null {
  return moduleState.db;
}

/**
 * Get ports (for internal use only)
 */
export function getConnectionsPorts(): IConnectionsPorts {
  return moduleState.ports;
}

/**
 * Check if module is initialized
 */
export function isConnectionsModuleInitialized(): boolean {
  return moduleState.initialized;
}

// ============================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================
export { initConnectionsModule } from './index.legacy.js';
export { connectionsAdminConfig, updateConnectionsConfig as updateLegacyConfig } from './admin/connections-admin.js';

// Re-export types
export type { ConnectionsModuleConfig } from './config/connections.config.js';
export type { 
  IConnectionsPorts, 
  IExchangePort, 
  IOnchainPort, 
  ISentimentPort, 
  IPricePort,
  ITelegramPort,
  ITwitterParserPort,
  PortMetadata,
} from './ports/index.js';
export { 
  COLLECTIONS 
} from './config/connections.config.js';
export {
  PORTS_VERSION,
  validatePorts,
  validatePort,
  nullPorts,
  nullExchangePort,
  nullOnchainPort,
  nullSentimentPort,
  nullPricePort,
  nullTelegramPort,
  nullTwitterParserPort,
} from './ports/index.js';
