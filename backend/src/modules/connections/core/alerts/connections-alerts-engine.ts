/**
 * Connections Alerts Engine
 * 
 * P2.1 Implementation - Preview-only alerts system
 * 
 * Features:
 * - Batch processing of accounts
 * - Alert event generation (not delivery)
 * - Cooldown and deduplication
 * - 3 event types: EARLY_BREAKOUT, STRONG_ACCELERATION, TREND_REVERSAL
 */

import { computeEarlySignalScore, EarlySignalInput, EarlySignalResult } from '../scoring/early-signal.js';

// ============================================================
// TYPES
// ============================================================

export type AlertType = 'EARLY_BREAKOUT' | 'STRONG_ACCELERATION' | 'TREND_REVERSAL';

export interface ConnectionsAlert {
  id: string;
  timestamp: string;
  type: AlertType;
  account: {
    author_id: string;
    username: string;
    profile: string;
  };
  severity: number;
  status: 'preview' | 'sent' | 'suppressed' | 'cooldown';
  reason: string;
  metrics_snapshot: {
    influence_base: number;
    influence_adjusted: number;
    velocity_norm: number;
    acceleration_norm: number;
    early_signal_score: number;
    trend_state: string;
    risk_level: string;
  };
  explain: string;
}

export interface AlertCondition {
  type: AlertType;
  enabled: boolean;
  severity_min: number;
  cooldown_minutes: number;
}

export interface AlertsEngineConfig {
  enabled: boolean;
  conditions: Record<AlertType, AlertCondition>;
  global_cooldown_minutes: number;
  max_alerts_per_run: number;
}

export interface AccountState {
  author_id: string;
  username: string;
  profile: 'retail' | 'influencer' | 'whale';
  risk_level: 'low' | 'medium' | 'high';
  influence_base: number;
  influence_adjusted: number;
  trend: {
    velocity_norm: number;
    acceleration_norm: number;
    state: 'growing' | 'cooling' | 'stable' | 'volatile';
  };
  early_signal: {
    score: number;
    badge: 'breakout' | 'rising' | 'none';
    confidence: number;
  };
}

// ============================================================
// STATE
// ============================================================

// Previous state cache for detecting changes
const previousStates = new Map<string, {
  trend_state: string;
  early_badge: string;
  risk_level: string;
  timestamp: number;
}>();

// Cooldown tracker: Map<account_id:alert_type, timestamp>
const cooldownTracker = new Map<string, number>();

// Generated alerts (in-memory for demo, would be DB in production)
let generatedAlerts: ConnectionsAlert[] = [];

// Engine config
let engineConfig: AlertsEngineConfig = {
  enabled: true,
  conditions: {
    EARLY_BREAKOUT: {
      type: 'EARLY_BREAKOUT',
      enabled: true,
      severity_min: 0.6,
      cooldown_minutes: 360, // 6 hours
    },
    STRONG_ACCELERATION: {
      type: 'STRONG_ACCELERATION',
      enabled: true,
      severity_min: 0.5,
      cooldown_minutes: 180, // 3 hours
    },
    TREND_REVERSAL: {
      type: 'TREND_REVERSAL',
      enabled: true,
      severity_min: 0.7,
      cooldown_minutes: 240, // 4 hours
    },
  },
  global_cooldown_minutes: 30,
  max_alerts_per_run: 20,
};

// ============================================================
// CORE ENGINE
// ============================================================

/**
 * Check if alert is in cooldown
 */
function isInCooldown(accountId: string, alertType: AlertType): boolean {
  const key = `${accountId}:${alertType}`;
  const lastAlert = cooldownTracker.get(key);
  
  if (!lastAlert) return false;
  
  const cooldownMs = engineConfig.conditions[alertType].cooldown_minutes * 60 * 1000;
  const elapsed = Date.now() - lastAlert;
  
  return elapsed < cooldownMs;
}

/**
 * Record alert for cooldown tracking
 */
function recordAlertCooldown(accountId: string, alertType: AlertType): void {
  const key = `${accountId}:${alertType}`;
  cooldownTracker.set(key, Date.now());
}

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Check EARLY_BREAKOUT condition
 */
function checkEarlyBreakout(account: AccountState): { match: boolean; severity: number; reason: string } {
  const condition = engineConfig.conditions.EARLY_BREAKOUT;
  
  // Early breakout criteria:
  // - badge == 'breakout'
  // - confidence > threshold
  // - risk != 'high'
  if (
    account.early_signal.badge === 'breakout' &&
    account.early_signal.confidence >= 0.5 &&
    account.risk_level !== 'high'
  ) {
    const severity = Math.min(1, account.early_signal.confidence + (account.trend.acceleration_norm * 0.3));
    
    if (severity >= condition.severity_min) {
      return {
        match: true,
        severity,
        reason: `Breakout detected: acceleration=${account.trend.acceleration_norm.toFixed(2)}, ` +
                `confidence=${(account.early_signal.confidence * 100).toFixed(0)}%, ` +
                `profile=${account.profile}`,
      };
    }
  }
  
  return { match: false, severity: 0, reason: '' };
}

/**
 * Check STRONG_ACCELERATION condition
 */
function checkStrongAcceleration(account: AccountState): { match: boolean; severity: number; reason: string } {
  const condition = engineConfig.conditions.STRONG_ACCELERATION;
  
  // Strong acceleration criteria:
  // - acceleration_norm > 0.4
  // - velocity_norm > 0.1 (positive direction)
  // - profile != 'whale' (or lower priority)
  const accelThreshold = 0.4;
  const velocityThreshold = 0.1;
  
  if (
    account.trend.acceleration_norm > accelThreshold &&
    account.trend.velocity_norm > velocityThreshold
  ) {
    // Whale accounts get lower priority
    const profileMultiplier = account.profile === 'whale' ? 0.6 : 1.0;
    const severity = Math.min(1, (account.trend.acceleration_norm * 0.7 + account.trend.velocity_norm * 0.3) * profileMultiplier);
    
    if (severity >= condition.severity_min) {
      return {
        match: true,
        severity,
        reason: `Strong acceleration: accel=${account.trend.acceleration_norm.toFixed(2)}, ` +
                `velocity=${account.trend.velocity_norm.toFixed(2)}, ` +
                `profile=${account.profile}`,
      };
    }
  }
  
  return { match: false, severity: 0, reason: '' };
}

/**
 * Check TREND_REVERSAL condition
 */
function checkTrendReversal(account: AccountState): { match: boolean; severity: number; reason: string } {
  const condition = engineConfig.conditions.TREND_REVERSAL;
  
  // Get previous state
  const prevState = previousStates.get(account.author_id);
  
  if (!prevState) {
    // No previous state - can't detect reversal
    return { match: false, severity: 0, reason: '' };
  }
  
  // Reversal detection:
  // - growing → cooling (bearish reversal)
  // - cooling → growing (bullish reversal)
  // - stable → volatile (instability warning)
  const significantReversals: [string, string, number, string][] = [
    ['growing', 'cooling', 0.8, 'Bearish reversal: was growing, now cooling'],
    ['cooling', 'growing', 0.9, 'Bullish reversal: was cooling, now growing'],
    ['stable', 'volatile', 0.6, 'Instability detected: was stable, now volatile'],
    ['growing', 'volatile', 0.7, 'Growing trend disrupted: now volatile'],
  ];
  
  for (const [from, to, baseSeverity, desc] of significantReversals) {
    if (prevState.trend_state === from && account.trend.state === to) {
      const severity = baseSeverity * (1 + Math.abs(account.trend.acceleration_norm) * 0.2);
      
      if (severity >= condition.severity_min) {
        return {
          match: true,
          severity: Math.min(1, severity),
          reason: `${desc}. Accel change: ${account.trend.acceleration_norm.toFixed(2)}`,
        };
      }
    }
  }
  
  return { match: false, severity: 0, reason: '' };
}

/**
 * Generate explain text for alert
 */
function generateExplain(account: AccountState, alertType: AlertType, reason: string): string {
  const baseExplain = {
    EARLY_BREAKOUT: `Account @${account.username} shows early breakout signals. ` +
                    `Influence adjusted from ${account.influence_base} to ${account.influence_adjusted}. ` +
                    `Early signal score: ${account.early_signal.score}. Risk level: ${account.risk_level}.`,
    STRONG_ACCELERATION: `Account @${account.username} is accelerating rapidly. ` +
                         `Current velocity: ${account.trend.velocity_norm.toFixed(3)}, ` +
                         `acceleration: ${account.trend.acceleration_norm.toFixed(3)}. ` +
                         `Trend state: ${account.trend.state}.`,
    TREND_REVERSAL: `Account @${account.username} trend has reversed. ` +
                    `Now in '${account.trend.state}' state. ` +
                    `Influence: ${account.influence_adjusted}. Risk: ${account.risk_level}.`,
  };
  
  return baseExplain[alertType];
}

/**
 * Process single account and generate alerts
 */
function processAccount(account: AccountState): ConnectionsAlert[] {
  const alerts: ConnectionsAlert[] = [];
  
  // Check each condition
  const checks: [AlertType, () => { match: boolean; severity: number; reason: string }][] = [
    ['EARLY_BREAKOUT', () => checkEarlyBreakout(account)],
    ['STRONG_ACCELERATION', () => checkStrongAcceleration(account)],
    ['TREND_REVERSAL', () => checkTrendReversal(account)],
  ];
  
  for (const [alertType, checkFn] of checks) {
    const condition = engineConfig.conditions[alertType];
    
    // Skip if disabled
    if (!condition.enabled) continue;
    
    // Check cooldown
    if (isInCooldown(account.author_id, alertType)) continue;
    
    // Run check
    const result = checkFn();
    
    if (result.match) {
      const alert: ConnectionsAlert = {
        id: generateAlertId(),
        timestamp: new Date().toISOString(),
        type: alertType,
        account: {
          author_id: account.author_id,
          username: account.username,
          profile: account.profile,
        },
        severity: result.severity,
        status: 'preview',
        reason: result.reason,
        metrics_snapshot: {
          influence_base: account.influence_base,
          influence_adjusted: account.influence_adjusted,
          velocity_norm: account.trend.velocity_norm,
          acceleration_norm: account.trend.acceleration_norm,
          early_signal_score: account.early_signal.score,
          trend_state: account.trend.state,
          risk_level: account.risk_level,
        },
        explain: generateExplain(account, alertType, result.reason),
      };
      
      alerts.push(alert);
      
      // Record cooldown
      recordAlertCooldown(account.author_id, alertType);
    }
  }
  
  // Update previous state
  previousStates.set(account.author_id, {
    trend_state: account.trend.state,
    early_badge: account.early_signal.badge,
    risk_level: account.risk_level,
    timestamp: Date.now(),
  });
  
  return alerts;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Run alerts engine batch
 * Processes all accounts and generates alerts
 */
export function runAlertsBatch(accounts: AccountState[]): {
  alerts_generated: number;
  alerts_by_type: Record<AlertType, number>;
  cooldown_blocked: number;
  accounts_processed: number;
} {
  if (!engineConfig.enabled) {
    return {
      alerts_generated: 0,
      alerts_by_type: { EARLY_BREAKOUT: 0, STRONG_ACCELERATION: 0, TREND_REVERSAL: 0 },
      cooldown_blocked: 0,
      accounts_processed: 0,
    };
  }
  
  let totalGenerated = 0;
  let cooldownBlocked = 0;
  const byType: Record<AlertType, number> = {
    EARLY_BREAKOUT: 0,
    STRONG_ACCELERATION: 0,
    TREND_REVERSAL: 0,
  };
  
  for (const account of accounts) {
    // Respect max alerts per run
    if (totalGenerated >= engineConfig.max_alerts_per_run) break;
    
    const alerts = processAccount(account);
    
    for (const alert of alerts) {
      if (totalGenerated >= engineConfig.max_alerts_per_run) break;
      
      generatedAlerts.push(alert);
      totalGenerated++;
      byType[alert.type]++;
    }
  }
  
  // Prune old alerts (keep last 100)
  if (generatedAlerts.length > 100) {
    generatedAlerts = generatedAlerts.slice(-100);
  }
  
  return {
    alerts_generated: totalGenerated,
    alerts_by_type: byType,
    cooldown_blocked: cooldownBlocked,
    accounts_processed: accounts.length,
  };
}

/**
 * Get all generated alerts
 */
export function getAlerts(filter?: {
  type?: AlertType;
  status?: 'preview' | 'sent' | 'suppressed';
  limit?: number;
}): ConnectionsAlert[] {
  let result = [...generatedAlerts];
  
  if (filter?.type) {
    result = result.filter(a => a.type === filter.type);
  }
  
  if (filter?.status) {
    result = result.filter(a => a.status === filter.status);
  }
  
  // Sort by timestamp descending
  result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  if (filter?.limit) {
    result = result.slice(0, filter.limit);
  }
  
  return result;
}

/**
 * Get alerts summary
 */
export function getAlertsSummary(): {
  total: number;
  preview: number;
  sent: number;
  suppressed: number;
  by_type: Record<AlertType, number>;
  last_run: string | null;
} {
  const total = generatedAlerts.length;
  const preview = generatedAlerts.filter(a => a.status === 'preview').length;
  const sent = generatedAlerts.filter(a => a.status === 'sent').length;
  const suppressed = generatedAlerts.filter(a => a.status === 'suppressed').length;
  
  const byType: Record<AlertType, number> = {
    EARLY_BREAKOUT: generatedAlerts.filter(a => a.type === 'EARLY_BREAKOUT').length,
    STRONG_ACCELERATION: generatedAlerts.filter(a => a.type === 'STRONG_ACCELERATION').length,
    TREND_REVERSAL: generatedAlerts.filter(a => a.type === 'TREND_REVERSAL').length,
  };
  
  const lastAlert = generatedAlerts[generatedAlerts.length - 1];
  
  return {
    total,
    preview,
    sent,
    suppressed,
    by_type: byType,
    last_run: lastAlert?.timestamp || null,
  };
}

/**
 * Update alert status
 */
export function updateAlertStatus(
  alertId: string, 
  status: 'sent' | 'suppressed'
): ConnectionsAlert | null {
  const alert = generatedAlerts.find(a => a.id === alertId);
  if (!alert) return null;
  
  alert.status = status;
  return alert;
}

/**
 * Get engine config
 */
export function getAlertsEngineConfig(): AlertsEngineConfig {
  return { ...engineConfig };
}

/**
 * Update engine config
 */
export function updateAlertsEngineConfig(updates: Partial<AlertsEngineConfig>): AlertsEngineConfig {
  if (updates.enabled !== undefined) {
    engineConfig.enabled = updates.enabled;
  }
  
  if (updates.conditions) {
    for (const [type, condition] of Object.entries(updates.conditions)) {
      if (engineConfig.conditions[type as AlertType]) {
        engineConfig.conditions[type as AlertType] = {
          ...engineConfig.conditions[type as AlertType],
          ...condition,
        };
      }
    }
  }
  
  if (updates.global_cooldown_minutes !== undefined) {
    engineConfig.global_cooldown_minutes = updates.global_cooldown_minutes;
  }
  
  if (updates.max_alerts_per_run !== undefined) {
    engineConfig.max_alerts_per_run = updates.max_alerts_per_run;
  }
  
  return { ...engineConfig };
}

/**
 * Clear all alerts (for testing)
 */
export function clearAlerts(): void {
  generatedAlerts = [];
  cooldownTracker.clear();
}

/**
 * Get cooldown status for an account
 */
export function getCooldownStatus(accountId: string): Record<AlertType, { in_cooldown: boolean; minutes_remaining: number }> {
  const result: Record<AlertType, { in_cooldown: boolean; minutes_remaining: number }> = {
    EARLY_BREAKOUT: { in_cooldown: false, minutes_remaining: 0 },
    STRONG_ACCELERATION: { in_cooldown: false, minutes_remaining: 0 },
    TREND_REVERSAL: { in_cooldown: false, minutes_remaining: 0 },
  };
  
  for (const type of ['EARLY_BREAKOUT', 'STRONG_ACCELERATION', 'TREND_REVERSAL'] as AlertType[]) {
    const key = `${accountId}:${type}`;
    const lastAlert = cooldownTracker.get(key);
    
    if (lastAlert) {
      const cooldownMs = engineConfig.conditions[type].cooldown_minutes * 60 * 1000;
      const elapsed = Date.now() - lastAlert;
      const remaining = cooldownMs - elapsed;
      
      if (remaining > 0) {
        result[type] = {
          in_cooldown: true,
          minutes_remaining: Math.ceil(remaining / 60000),
        };
      }
    }
  }
  
  return result;
}

console.log('[AlertsEngine] Connections Alerts Engine initialized');
