/**
 * ML Module Index (Phase 5.1 + 5.2)
 */

// Quality (5.1)
export { evaluateAlertQuality, computeDeterministicAQM, labelFromProb } from './quality/alert-quality.engine.js';
export { DEFAULT_AQM_CONFIG, type AQMConfig } from './quality/alert-quality.config.js';
export type { AlertContext, AlertQualityResult, AQMLabel, AQMRecommendation } from './quality/alert-quality.types.js';
export { buildAQMExplain } from './quality/alert-quality.explain.js';

// Patterns (5.2)
export { detectPatterns } from './patterns/patterns.engine.js';
export { DEFAULT_PATTERNS_CONFIG, type PatternsConfig } from './patterns/patterns.config.js';
export type { PatternInput, PatternResult, PatternFlag, PatternSeverity } from './patterns/patterns.types.js';

// Routes
export { registerMLRoutes, registerAdminMLRoutes, getAQMConfig, getPatternsConfig } from './ml.routes.js';
