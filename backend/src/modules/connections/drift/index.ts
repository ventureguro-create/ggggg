/**
 * Drift v1 Module Index
 * Phase 6.0 — Environment Observation Layer
 * 
 * EXPORTS:
 * - Types
 * - Services (baseline, compute, report)
 * - Routes
 */

// Types
export * from './drift.types.js';
export * from './drift.constants.js';

// Services
export { 
  getBaseline, 
  getBaselineDataMetrics,
  getBaselineNetworkMetrics,
  getBaselineConceptMetrics,
  updateBaseline, 
  captureNewBaseline 
} from './drift.baseline.service.js';

export {
  computeMetricDrift,
  classifyDeltaToLevel,
  aggregateSectionLevel,
  buildSection,
  computeOverallLevel
} from './drift.compute.service.js';

export {
  buildDriftReport,
  getDriftStatus,
  canExpandLive
} from './drift.report.service.js';

// Routes
export { registerDriftRoutes } from './drift.routes.js';

console.log('[Drift] Module loaded (Phase 6.0 — Observation Layer)');
