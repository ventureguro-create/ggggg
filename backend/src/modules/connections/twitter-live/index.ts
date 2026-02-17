/**
 * Twitter Live Module (Phase 4.2 + 4.3)
 * 
 * Phase 4.2: Read-only Twitter ingestion for safe validation.
 * Phase 4.3: Live Switch with gradual enable and guards.
 * 
 * Key principles:
 * - NO WRITES to core Connections
 * - NO ALERTS generated (until Phase 4.5)
 * - Blend formula: value = mock * (1-w) + live * w
 * - Guards protect against unsafe enables
 * - Instant rollback available
 */

export { getTwitterLiveConfig, updateTwitterLiveConfig, setTwitterLiveMode } from './config.js';
export { readTwitterLiveData, type TwitterLiveReadResult } from './reader.js';
export { computeBatchDiff, computeAccountDiff, type AccountDiffResult, type BatchDiffResult } from './diff.service.js';
export { registerTwitterLiveRoutes } from './routes.js';

// Phase 4.3 exports
export { 
  getParticipationConfig, 
  updateParticipationConfig, 
  updateComponentParticipation,
  rollbackAll,
  rollbackComponent,
  getEffectiveWeight,
  type LiveParticipationConfig,
  type ComponentParticipation 
} from './participation.config.js';

export {
  checkGuards,
  addAuditEvent,
  getAuditLog,
  runMonitor,
  killSwitch,
  type GuardCheckResult,
  type ComponentMetrics,
  type AuditEvent
} from './participation.guards.js';

export {
  blendValue,
  computeBlendedMetrics,
  previewBlend,
  gradeChanged,
  getGrade,
  type BlendedMetrics
} from './participation.blender.js';

export { registerParticipationRoutes } from './participation.routes.js';
