/**
 * Truth Graph Module Index
 * 
 * PHASE H: Graph of causality - Actor → Event → Asset → Outcome
 * 
 * This is a research/admin layer, NOT a user product.
 * Shows WHO influences WHAT through WHOM.
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { truthGraphAdminRoutes } from './admin/truth-graph-admin.routes.js';
import { TruthGraphBuilder } from './services/truth-graph-builder.service.js';

// Re-export types
export * from './models/truth-graph.types.js';

// Re-export services
export { TruthGraphBuilder } from './services/truth-graph-builder.service.js';
export { calculateTruthWeight, calculateActorCorrelation } from './services/truth-weight.service.js';

/**
 * Register Truth Graph module
 */
export async function registerTruthGraphModule(app: FastifyInstance, db: Db) {
  console.log('[TruthGraph] Registering PHASE H - Truth Graph module...');
  
  // Admin routes
  await truthGraphAdminRoutes(app, db);
  
  // Create builder instance for other modules
  const builder = new TruthGraphBuilder(db);
  app.decorate('truthGraphBuilder', builder);
  
  console.log('[TruthGraph] Module registered successfully');
  console.log('[TruthGraph] ⚠️ ADMIN-ONLY: Research layer at /api/admin/truth-graph/*');
}
