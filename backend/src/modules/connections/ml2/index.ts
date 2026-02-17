/**
 * ML2 Module Index
 * Phase 5.3 — ML2 Shadow Enable
 * Phase C2 — Feedback & Impact Layer
 * 
 * Exports all ML2 functionality
 */

// Types
export * from './contracts/ml2.types.js';

// Features
export { buildMl2Features, buildFeatureHash } from './features/build-ml2-features.js';

// Model
export { ml2ShadowModelV1 } from './model/ml2-shadow-model.js';

// Storage
export { initMl2ConfigStore, getMl2Config, updateMl2Config, getMl2Mode } from './storage/ml2-config.store.js';
export { initMl2ShadowLogStore, logShadowPrediction, getShadowStats, getRecentShadowLogs, getDisagreements } from './storage/ml2-shadow-log.store.js';
export { initMl2PredictionsStore, savePrediction, getPrediction, getPredictionsByHash } from './storage/ml2-predictions.store.js';

// Service
export { evaluateShadow, enforceShadowGate } from './service/ml2-shadow.service.js';

// Routes
export { registerMl2AdminRoutes } from './api/ml2-admin.routes.js';

// Phase C2 — Feedback & Impact
export * from './feedback/index.js';
export * from './impact/index.js';
export { registerFeedbackRoutes, registerImpactRoutes } from './api/feedback-impact.routes.js';

console.log('[ML2] Module loaded (Phase 5.3 + C2 — Shadow + Feedback & Impact)');
