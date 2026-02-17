/**
 * Reality Module - PHASE E
 * 
 * E2: Reality Gate (alerts + UI)
 * E4: Reality Score Leaderboard
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';

export * from './contracts/reality.types.js';
export * from './services/realityEvaluator.service.js';
export * from './services/walletCredibility.service.js';
export * from './services/realityGate.service.js';
export * from './services/realityLeaderboard.service.js';
export * from './stores/realityLedger.store.js';
export { RealityLedgerStore } from './storage/reality-ledger.store.js';
export { RealityEvaluatorService } from './services/reality-evaluator.service.js';
export { registerRealityPublicRoutes } from './routes/reality.public.routes.js';
export { registerRealityAdminRoutes as registerRealityAdminRoutesV2 } from './routes/reality.admin.routes.js';

import { registerRealityRoutes } from './routes/reality.routes.js';
import { registerRealityAdminRoutes } from './routes/reality-admin.routes.js';

export function registerRealityModule(app: FastifyInstance, db: Db) {
  registerRealityRoutes(app, db);
  registerRealityAdminRoutes(app, db);
  console.log('[Reality] Module registered (E2 + E4)');
}

console.log('[Reality] Module loaded');
