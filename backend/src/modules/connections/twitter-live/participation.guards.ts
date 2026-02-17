/**
 * Live Participation Guards (Phase 4.3.2)
 * 
 * Safety checks before enabling live data participation.
 * Blocks unsafe enables, degrades risky ones, allows safe ones.
 */

import { getParticipationConfig, rollbackComponent, rollbackAll, type LiveParticipationConfig } from './participation.config.js';
import { computeTwitterConfidence } from '../twitter-confidence/index.js';

/**
 * Guard check result
 */
export interface GuardCheckResult {
  passed: boolean;
  decision: 'ALLOW' | 'DEGRADE' | 'BLOCK';
  effective_weight: number;
  reasons: string[];
  metrics: {
    confidence: number;
    diff_delta: number;
    spike_ratio: number;
    freshness_days: number;
  };
}

/**
 * Component metrics for guard evaluation
 */
export interface ComponentMetrics {
  mock_value: number;
  live_value: number;
  confidence: number;
  data_age_hours: number;
  spike_ratio?: number;
  has_data: boolean;
}

/**
 * Check guards for enabling a component
 */
export function checkGuards(
  component: string,
  requestedWeight: number,
  metrics: ComponentMetrics
): GuardCheckResult {
  const config = getParticipationConfig();
  const guards = config.guards;
  const reasons: string[] = [];
  
  // Calculate metrics
  const diff_delta = metrics.mock_value > 0
    ? Math.abs(metrics.live_value - metrics.mock_value) / metrics.mock_value
    : metrics.live_value > 0 ? 1 : 0;
  
  const freshness_days = metrics.data_age_hours / 24;
  const spike_ratio = metrics.spike_ratio ?? 1.0;
  const confidence = metrics.confidence;
  
  const result: GuardCheckResult = {
    passed: true,
    decision: 'ALLOW',
    effective_weight: requestedWeight,
    reasons: [],
    metrics: {
      confidence,
      diff_delta,
      spike_ratio,
      freshness_days,
    },
  };
  
  // No data = BLOCK
  if (!metrics.has_data) {
    result.passed = false;
    result.decision = 'BLOCK';
    result.effective_weight = 0;
    result.reasons.push('NO_DATA');
    return result;
  }
  
  // Check confidence
  if (confidence < guards.min_confidence) {
    result.passed = false;
    result.decision = 'BLOCK';
    result.effective_weight = 0;
    result.reasons.push(`CONFIDENCE_TOO_LOW (${confidence.toFixed(0)} < ${guards.min_confidence})`);
    return result;
  }
  
  // Check freshness
  if (freshness_days > guards.freshness_days) {
    result.passed = false;
    result.decision = 'BLOCK';
    result.effective_weight = 0;
    result.reasons.push(`DATA_TOO_OLD (${freshness_days.toFixed(1)}d > ${guards.freshness_days}d)`);
    return result;
  }
  
  // Check spike
  if (spike_ratio > guards.max_spike) {
    result.passed = false;
    result.decision = 'BLOCK';
    result.effective_weight = 0;
    result.reasons.push(`SPIKE_DETECTED (${spike_ratio.toFixed(1)}x > ${guards.max_spike}x)`);
    return result;
  }
  
  // Check diff delta - DEGRADE if too high
  if (diff_delta > guards.max_delta) {
    result.decision = 'DEGRADE';
    result.effective_weight = Math.min(requestedWeight, guards.max_safe_weight);
    result.reasons.push(`DIFF_TOO_HIGH (${(diff_delta * 100).toFixed(0)}% > ${guards.max_delta * 100}%)`);
    result.reasons.push(`WEIGHT_CLAMPED (${requestedWeight}% → ${result.effective_weight}%)`);
    return result;
  }
  
  // All checks passed
  result.decision = 'ALLOW';
  result.effective_weight = requestedWeight;
  return result;
}

/**
 * Audit event for tracking
 */
export interface AuditEvent {
  timestamp: Date;
  action: 'ENABLE' | 'DISABLE' | 'ROLLBACK' | 'AUTO_ROLLBACK' | 'GUARD_BLOCK' | 'GUARD_DEGRADE';
  component: string;
  details: {
    requested_weight?: number;
    effective_weight?: number;
    decision?: string;
    reasons?: string[];
    triggered_by?: string;
  };
}

// In-memory audit log (last 100 events)
const auditLog: AuditEvent[] = [];
const MAX_AUDIT_EVENTS = 100;

/**
 * Add audit event
 */
export function addAuditEvent(event: AuditEvent): void {
  auditLog.unshift(event);
  if (auditLog.length > MAX_AUDIT_EVENTS) {
    auditLog.pop();
  }
  console.log(`[Audit] ${event.action} ${event.component}:`, event.details);
}

/**
 * Get audit log
 */
export function getAuditLog(limit: number = 50): AuditEvent[] {
  return auditLog.slice(0, limit);
}

/**
 * Monitor running components and trigger auto-rollback if needed
 */
export function runMonitor(
  componentMetrics: Map<string, ComponentMetrics>
): { rollbacks: string[]; warnings: string[] } {
  const config = getParticipationConfig();
  const rollbacks: string[] = [];
  const warnings: string[] = [];
  
  if (!config.auto_rollback.enabled) {
    return { rollbacks, warnings };
  }
  
  const components = Object.keys(config.components) as Array<keyof typeof config.components>;
  
  for (const comp of components) {
    const compConfig = config.components[comp];
    if (!compConfig.enabled) continue;
    
    const metrics = componentMetrics.get(comp);
    if (!metrics) continue;
    
    const checkResult = checkGuards(comp, compConfig.weight, metrics);
    
    // Auto-rollback on spike
    if (config.auto_rollback.trigger_on_spike && checkResult.metrics.spike_ratio > config.guards.max_spike) {
      rollbackComponent(comp, `AUTO_SPIKE: ${checkResult.metrics.spike_ratio.toFixed(1)}x`);
      rollbacks.push(comp);
      addAuditEvent({
        timestamp: new Date(),
        action: 'AUTO_ROLLBACK',
        component: comp,
        details: {
          reasons: [`Spike detected: ${checkResult.metrics.spike_ratio.toFixed(1)}x`],
          triggered_by: 'monitor',
        },
      });
      continue;
    }
    
    // Auto-rollback on confidence drop
    if (config.auto_rollback.trigger_on_confidence_drop && checkResult.metrics.confidence < config.guards.min_confidence) {
      rollbackComponent(comp, `AUTO_CONFIDENCE: ${checkResult.metrics.confidence.toFixed(0)}%`);
      rollbacks.push(comp);
      addAuditEvent({
        timestamp: new Date(),
        action: 'AUTO_ROLLBACK',
        component: comp,
        details: {
          reasons: [`Confidence dropped: ${checkResult.metrics.confidence.toFixed(0)}%`],
          triggered_by: 'monitor',
        },
      });
      continue;
    }
    
    // Warning for degraded
    if (checkResult.decision === 'DEGRADE') {
      warnings.push(`${comp}: ${checkResult.reasons.join(', ')}`);
    }
  }
  
  return { rollbacks, warnings };
}

/**
 * Kill switch - rollback everything immediately
 */
export function killSwitch(reason: string, triggeredBy: string): void {
  rollbackAll(reason, triggeredBy);
  addAuditEvent({
    timestamp: new Date(),
    action: 'ROLLBACK',
    component: 'ALL',
    details: {
      reasons: [reason],
      triggered_by: triggeredBy,
    },
  });
}
