/**
 * IPS Module Index
 * 
 * PHASE G: Informed Action Probability
 * 
 * ⚠️ INTEGRATION RULES:
 * - IPS is ADMIN-ONLY analytical layer
 * - NOT used in alerts
 * - NOT used in token scoring
 * - NOT shown to end users (for now)
 * - Only measures, never triggers
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { ipsAdminRoutes } from './admin/ips-admin.routes.js';
import { IPSService } from './ips.service.js';

// Re-export types
export * from './models/ips.types.js';
export * from './constants/ips.constants.js';

// Re-export services
export { IPSService } from './ips.service.js';
export { captureEvent, captureEvents } from './services/event-capture.service.js';
export { getMarketSnapshot, getWindowSnapshots } from './services/market-snapshot.service.js';
export { classifyOutcome, getOutcomeLabel, getOutcomeColor } from './services/outcome-classification.service.js';
export { computeIPS, calculateFullIPS, calculateAuthorityModifier, getVerdict } from './services/ips-score.service.js';
export { IPSPersistService } from './services/ips-persist.service.js';

/**
 * Register IPS module routes
 */
export async function registerIPSModule(app: FastifyInstance, db: Db) {
  console.log('[IPS] Registering Informed Action Probability module...');
  
  // Admin routes only
  await ipsAdminRoutes(app, db);
  
  // Create service instance
  const ipsService = new IPSService(db);
  
  // Attach to app for other modules to use
  app.decorate('ipsService', ipsService);
  
  console.log('[IPS] Module registered successfully');
  console.log('[IPS] ⚠️ ADMIN-ONLY: IPS data available at /api/admin/ips/*');
}
