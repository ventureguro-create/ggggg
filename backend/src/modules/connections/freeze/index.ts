/**
 * Micro-Freeze Module - T2.5
 * 
 * Entry point for Micro-Freeze Pipeline
 */

import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';

// Import directly for use in init function
import { initMicroFreezeStore, activateMicroFreeze, getMicroFreezeConfig } from './micro-freeze.store.js';
import { registerMicroFreezeRoutes } from './micro-freeze.routes.js';
import { initProductionFreezeStore } from './production-freeze.store.js';
import { registerProductionFreezeRoutes } from './production-freeze.routes.js';

// Re-exports - order matters for avoiding circular dependencies
export * from './micro-freeze.types.js';
export { 
  initMicroFreezeStore,
  getMicroFreezeConfig,
  updateMicroFreezeConfig,
  activateMicroFreeze,
  deactivateMicroFreeze,
  isMicroFreezeActive,
  incrementViolationsBlocked,
  incrementRollbacksTriggered,
  logViolation,
  getViolations,
  getViolationStats,
} from './micro-freeze.store.js';
export {
  guardNetworkWeightChange,
  guardConfidenceGateChange,
  guardMl2ModeChange,
  checkDriftGuard,
  guardNewAlertType,
  guardThresholdChange,
  getFreezeStatus,
  isMicroFreezeActive as isMicroFreezeActiveFromGuard,
  type GuardResult,
} from './micro-freeze.guard.js';

// Production Freeze exports
export * from './production-freeze.types.js';
export * from './production-freeze.store.js';

/**
 * Initialize Micro-Freeze module
 */
export async function initMicroFreezeModule(db: Db, app: FastifyInstance): Promise<void> {
  // Initialize stores
  initMicroFreezeStore(db);
  initProductionFreezeStore(db);
  
  // Register routes
  registerMicroFreezeRoutes(app);
  registerProductionFreezeRoutes(app);
  
  // Check if should auto-activate (for T2.5 we want it active by default)
  const config = await getMicroFreezeConfig();
  
  if (config.status === 'INACTIVE') {
    console.log('[MicroFreeze] Module initialized in INACTIVE state');
    console.log('[MicroFreeze] Use POST /api/admin/connections/freeze/activate to enable');
  } else {
    console.log(`[MicroFreeze] 🧊 Module initialized - Status: ${config.status}`);
  }
  
  console.log('[ProductionFreeze] Routes available at /api/admin/connections/production-freeze/*');
}

console.log('[MicroFreeze] Module loaded (T2.5)');
