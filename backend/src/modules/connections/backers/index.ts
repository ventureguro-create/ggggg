/**
 * Backers Module - Phase 1 + E5
 * 
 * Real-world entities (funds, projects, DAOs) that provide
 * seed authority independent of Twitter.
 * 
 * E5: Backer Influence Network (visualization + aggregation)
 * 
 * Key exports:
 * - Types
 * - Store (CRUD)
 * - Inheritance Engine
 * - Influence Service (E5)
 * - Routes (Admin + Read + Influence)
 */

// Types
export * from './backer.types.js';
export * from './backerInfluence.types.js';

// Models (for direct access if needed)
export { BackerModel, BackerBindingModel, BackerAuditModel } from './backer.model.js';

// Store
export * as BackerStore from './backer.store.js';

// Inheritance Engine
export * as BackerInheritanceEngine from './backer.inheritance.engine.js';

// E5: Influence Service
export * as BackerInfluenceService from './backerInfluence.service.js';

// Routes
export { registerBackerAdminRoutes } from './backer.admin.routes.js';
export { registerBackerReadRoutes } from './backer.read.routes.js';
export { registerBackerInfluenceRoutes } from './backerInfluence.routes.js';

console.log('[Backers] Module loaded (Phase 1 + E5)');
