/**
 * Connections Alerts Module Index
 * Phase 4.5.1 + 4.5.2
 */

// Alerts Engine (batch processing)
export {
  runAlertsBatch,
  getAlerts,
  getAlertsSummary,
  updateAlertStatus,
  getAlertsEngineConfig,
  updateAlertsEngineConfig,
  clearAlerts,
  getCooldownStatus,
  type AlertType,
  type ConnectionsAlert,
  type AlertsEngineConfig,
  type AccountState,
} from './connections-alerts-engine.js';

// Alert Policy Engine (decision layer)
export {
  checkAlertPolicy,
  checkAlertPolicyAsync,
  getAlertPolicyConfig,
  updateAlertPolicyConfig,
  getAlertPolicyAudit,
  getAlertPolicyStats,
  killSwitch,
  testAlertPolicy,
  setRollbackActive,
  loadConfigFromStore,
  type AlertCandidate,
  type PolicyDecision,
  type AlertPayload,
  type BlockReason,
  type AlertDecision,
  DEFAULT_ALERT_POLICY,
} from './alert-policy.engine.js';

// Alert Policy Store (MongoDB persistence)
export {
  AlertPolicyStore,
  initAlertPolicyStore,
  getAlertPolicyStore,
  computeWindowStart,
  computeDedupHash,
  type AuditEntry,
  type PendingAlert,
} from './alert-policy.store.js';

// Routes
export { registerAlertPolicyRoutes } from './alert-policy.routes.js';
