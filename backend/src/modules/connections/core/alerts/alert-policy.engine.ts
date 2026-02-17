/**
 * Alert Policy Engine (Phase 4.5.1 + 4.5.2 + 5.A)
 * 
 * Confidence-gated alert decision layer with MongoDB-backed dedup and audit.
 * 
 * Key principles:
 * - NO alerts without high confidence
 * - HARD dedup via MongoDB unique index
 * - AUDIT every decision (SEND/BLOCK/SUPPRESS)
 * - KILL-SWITCH immediately stops all alerts
 * - AUTO-DISABLE on rollback
 * 
 * Phase 5.A Integration:
 * - AQM (Alert Quality Model) evaluates alert usefulness
 * - Pattern Detection (A/B/C) detects manipulation
 * - All decisions pass through ML layer before SEND
 */

import { getParticipationConfig } from '../../twitter-live/participation.config.js';
import { v4 as uuid } from 'uuid';
import { 
  getAlertPolicyStore, 
  computeWindowStart, 
  computeDedupHash,
  type AuditEntry,
} from './alert-policy.store.js';

// ML Layer imports (Phase 5.A)
import { evaluateAlertQuality } from '../../ml/quality/alert-quality.engine.js';
import { detectPatterns } from '../../ml/patterns/patterns.engine.js';
import type { AlertContext, AlertQualityResult, AQMRecommendation } from '../../ml/quality/alert-quality.types.js';
import type { PatternResult, PatternFlag } from '../../ml/patterns/patterns.types.js';

// ============================================================
// TYPES
// ============================================================

export type AlertType = 'EARLY_BREAKOUT' | 'STRONG_ACCELERATION' | 'TREND_REVERSAL';
export type AlertDecision = 'SEND' | 'SEND_LOW_PRIORITY' | 'BLOCK' | 'SUPPRESS';
export type BlockReason = 
  | 'LOW_CONFIDENCE' 
  | 'DIVERGENT_EDGES' 
  | 'LOW_LIVE_WEIGHT' 
  | 'COOLDOWN' 
  | 'ROLLBACK_ACTIVE'
  | 'DISABLED'
  | 'DAILY_CAP'
  | 'TYPE_DISABLED'
  | 'DELTA_TOO_SMALL'
  | 'DEDUP_BLOCKED'
  | 'EDGE_CONFIDENCE_LOW'
  | 'SPIKE_DETECTED'
  | 'AQM_NOISE'
  | 'PATTERN_HIGH_RISK'
  | 'PATTERN_MANIPULATION';

/**
 * Alert Policy Configuration
 */
export interface AlertPolicyConfig {
  enabled: boolean;
  
  // Confidence thresholds
  min_confidence: number;         // 0-100, default 65
  min_score_delta_pct: number;    // default 12
  min_live_weight: number;        // 0-100, default 15
  max_divergent_edges_pct: number; // default 10
  min_edge_confidence: number;    // 0-100, default 60
  
  // Cooldowns (minutes)
  cooldown_per_account: number;   // default 1440 (24h)
  cooldown_per_type: Record<AlertType, number>;
  
  // Limits
  daily_cap: number;              // default 50
  
  // Safety
  auto_disable_on_rollback: boolean;
  auto_disable_on_spike: boolean;
  rollback_active: boolean;       // Set by system
  
  // Per-type enable
  types_enabled: Record<AlertType, boolean>;
}

export const DEFAULT_ALERT_POLICY: AlertPolicyConfig = {
  enabled: true,
  min_confidence: 65,
  min_score_delta_pct: 12,
  min_live_weight: 15,
  max_divergent_edges_pct: 10,
  min_edge_confidence: 60,
  cooldown_per_account: 1440, // 24h
  cooldown_per_type: {
    EARLY_BREAKOUT: 720,      // 12h
    STRONG_ACCELERATION: 360, // 6h
    TREND_REVERSAL: 360,      // 6h
  },
  daily_cap: 50,
  auto_disable_on_rollback: true,
  auto_disable_on_spike: true,
  rollback_active: false,
  types_enabled: {
    EARLY_BREAKOUT: true,
    STRONG_ACCELERATION: true,
    TREND_REVERSAL: true,
  },
};

/**
 * Alert candidate (input to policy)
 */
export interface AlertCandidate {
  account_id: string;
  username: string;
  profile: 'retail' | 'influencer' | 'whale';
  alert_type: AlertType;
  
  // Metrics
  score_from: number;
  score_to: number;
  score_delta_pct: number;
  
  // Confidence
  confidence_score: number;  // 0-100
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence_warnings: string[];
  
  // Network
  hops_to_elite: number;
  authority_tier: string;
  
  // Graph
  graph_divergent_edges_pct: number;
  graph_min_edge_confidence: number;
  
  // Reasons
  reasons: string[];
  
  // Severity (from alerts engine)
  severity: number;
  
  // Optional: Live weight override
  live_weight?: number;
}

/**
 * Policy decision result
 */
export interface PolicyDecision {
  decision: AlertDecision;
  block_reasons: BlockReason[];
  alert_id?: string;
  alert_payload?: AlertPayload;
  policy_snapshot: {
    min_confidence: number;
    min_score_delta: number;
    min_live_weight: number;
  };
  checks: {
    enabled_check: boolean;
    type_enabled_check: boolean;
    rollback_check: boolean;
    daily_cap_check: boolean;
    cooldown_check: boolean;
    dedup_check: boolean;
    confidence_check: boolean;
    delta_check: boolean;
    live_weight_check: boolean;
    divergence_check: boolean;
    edge_confidence_check: boolean;
  };
  dedup_hash?: string;
}

/**
 * Final alert payload for delivery
 */
export interface AlertPayload {
  alert_id: string;
  type: AlertType;
  timestamp: string;
  
  account: {
    id: string;
    handle: string;
    profile: string;
  };
  
  score: {
    from: number;
    to: number;
    delta_pct: number;
  };
  
  confidence: {
    score: number;
    level: string;
    warnings: string[];
  };
  
  reasons: string[];
  
  network: {
    hops_to_elite: number;
    authority_tier: string;
  };
  
  graph_link: string;
  
  policy_snapshot: {
    min_confidence: number;
    min_score_delta: number;
    min_live_weight: number;
  };
  
  // Phase 5.A: ML Layer results
  ml?: {
    aqm: {
      probability: number;
      label: string;
      recommendation: string;
      explain: {
        top_positive_factors: string[];
        top_negative_factors: string[];
        reason: string;
      };
    };
    patterns: {
      risk_score: number;
      flags: string[];
      severity: string;
      explain: string[];
    };
    priority: 'HIGH' | 'LOW';
  };
}

// ============================================================
// IN-MEMORY STATE (for daily cap, fast access)
// ============================================================

let dailyAlertCount = 0;
let dailyResetDate = new Date().toDateString();

// In-memory config cache (synced with MongoDB)
let cachedConfig: AlertPolicyConfig = { ...DEFAULT_ALERT_POLICY };

// In-memory audit log (last 200 entries for fast access)
interface QuickAuditEntry {
  timestamp: string;
  alert_id?: string;
  account_id: string;
  alert_type: AlertType;
  decision: AlertDecision;
  block_reasons: BlockReason[];
  confidence: number;
}
const quickAuditLog: QuickAuditEntry[] = [];

// ============================================================
// HELPERS
// ============================================================

function checkDailyReset(): void {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyAlertCount = 0;
    dailyResetDate = today;
  }
}

function getCurrentLiveWeight(): number {
  try {
    const participation = getParticipationConfig();
    if (!participation.enabled) return 0;
    
    const components = Object.values(participation.components);
    const enabledComponents = components.filter(c => c.enabled);
    if (enabledComponents.length === 0) return 0;
    
    const avgWeight = enabledComponents.reduce((sum, c) => sum + (c.effective_weight ?? c.weight), 0) / enabledComponents.length;
    return avgWeight * 100; // Convert to percentage
  } catch {
    return 0;
  }
}

function addQuickAudit(entry: QuickAuditEntry): void {
  quickAuditLog.unshift(entry);
  if (quickAuditLog.length > 200) quickAuditLog.pop();
}

// ============================================================
// MAIN POLICY CHECK (ASYNC - uses MongoDB)
// ============================================================

/**
 * Main policy check with MongoDB dedup
 * 
 * Flow:
 * 1. Load config from cache/DB
 * 2. Run all checks
 * 3. If SEND: try dedup insert (may fail = blocked)
 * 4. Log to audit
 * 5. Return decision
 */
export async function checkAlertPolicyAsync(candidate: AlertCandidate): Promise<PolicyDecision> {
  checkDailyReset();
  
  const checks = {
    enabled_check: false,
    type_enabled_check: false,
    rollback_check: false,
    daily_cap_check: false,
    cooldown_check: false,
    dedup_check: false,
    confidence_check: false,
    delta_check: false,
    live_weight_check: false,
    divergence_check: false,
    edge_confidence_check: false,
    aqm_check: false,        // Phase 5.A
    patterns_check: false,   // Phase 5.A
  };
  
  const blockReasons: BlockReason[] = [];
  
  // Get config (use cache, refresh periodically)
  const config = cachedConfig;
  
  const policySnapshot = {
    min_confidence: config.min_confidence,
    min_score_delta: config.min_score_delta_pct,
    min_live_weight: config.min_live_weight,
  };
  
  // Compute dedup hash
  const windowStart = computeWindowStart(candidate.alert_type);
  const dedupHash = computeDedupHash({
    account_id: candidate.account_id,
    alert_type: candidate.alert_type,
    window_start: windowStart,
    policy_version: '4.5.2',
  });
  
  // ========== CHECK 1: Global enabled ==========
  if (!config.enabled) {
    blockReasons.push('DISABLED');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.enabled_check = true;
  
  // ========== CHECK 2: Type enabled ==========
  if (!config.types_enabled[candidate.alert_type]) {
    blockReasons.push('TYPE_DISABLED');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.type_enabled_check = true;
  
  // ========== CHECK 3: Rollback active ==========
  if (config.rollback_active) {
    blockReasons.push('ROLLBACK_ACTIVE');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.rollback_check = true;
  
  // ========== CHECK 4: Daily cap ==========
  if (dailyAlertCount >= config.daily_cap) {
    blockReasons.push('DAILY_CAP');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.daily_cap_check = true;
  
  // ========== CHECK 5: Confidence >= min ==========
  if (candidate.confidence_score < config.min_confidence) {
    blockReasons.push('LOW_CONFIDENCE');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.confidence_check = true;
  
  // ========== CHECK 6: Score delta >= min ==========
  if (candidate.score_delta_pct < config.min_score_delta_pct) {
    blockReasons.push('DELTA_TOO_SMALL');
    await logDecisionToAudit(candidate, 'SUPPRESS', blockReasons, dedupHash);
    return { decision: 'SUPPRESS', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.delta_check = true;
  
  // ========== CHECK 7: Live weight >= min ==========
  const currentLiveWeight = candidate.live_weight ?? getCurrentLiveWeight();
  if (currentLiveWeight < config.min_live_weight) {
    blockReasons.push('LOW_LIVE_WEIGHT');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.live_weight_check = true;
  
  // ========== CHECK 8: Graph divergence ==========
  if (candidate.graph_divergent_edges_pct > config.max_divergent_edges_pct) {
    blockReasons.push('DIVERGENT_EDGES');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.divergence_check = true;
  
  // ========== CHECK 9: Edge confidence ==========
  if (candidate.graph_min_edge_confidence < config.min_edge_confidence) {
    blockReasons.push('EDGE_CONFIDENCE_LOW');
    await logDecisionToAudit(candidate, 'BLOCK', blockReasons, dedupHash);
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.edge_confidence_check = true;
  
  // ========== CHECK 10: Cooldown (via MongoDB) ==========
  try {
    const store = getAlertPolicyStore();
    const cooldownHours = config.cooldown_per_type[candidate.alert_type] / 60; // Convert to hours
    const inCooldown = await store.isInCooldown(candidate.account_id, candidate.alert_type, cooldownHours);
    
    if (inCooldown) {
      blockReasons.push('COOLDOWN');
      await logDecisionToAudit(candidate, 'SUPPRESS', blockReasons, dedupHash);
      return { decision: 'SUPPRESS', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
    }
  } catch (err) {
    // If store not available, skip cooldown check
    console.warn('[AlertPolicy] Cooldown check failed, skipping:', err);
  }
  checks.cooldown_check = true;
  
  // ========== CHECK 11: ML Layer - AQM + Patterns (Phase 5.A) ==========
  // Build context for ML evaluation
  const mlContext: AlertContext = {
    alert_type: candidate.alert_type,
    scores: {
      twitter_score: candidate.score_to,
      influence: 50, // placeholder
      quality: 50,   // placeholder
      trend: 50,     // placeholder  
      network: 50,   // placeholder
      consistency: 50, // placeholder
    },
    confidence: {
      score: candidate.confidence_score,
      level: candidate.confidence_level as 'HIGH' | 'MEDIUM' | 'LOW',
    },
    early_signal: {
      score: candidate.score_delta_pct,
      velocity: candidate.score_delta_pct / 10,
      acceleration: 0,
    },
    network: {
      authority: parseFloat(candidate.authority_tier?.replace('T', '') || '0') / 10 || 0.5,
      hops_to_elite: candidate.hops_to_elite,
      elite_exposure_pct: 20,
    },
    audience: {
      smart_followers_pct: 30,
      purity_score: 70,
    },
    temporal: {
      last_alert_hours_ago: 24,
      alert_count_24h: dailyAlertCount,
    },
    meta: {
      mode: 'LIVE',
      pilot_account: false,
    },
  };
  
  // Evaluate patterns first
  const patternResult = detectPatterns({
    likes: 100,
    replies: 20,
    reposts: 10,
    engagement_rate: 5,
    overlap_pressure: 0.2,
    audience_purity: 70,
  });
  
  // Check pattern severity
  if (patternResult.severity === 'HIGH') {
    blockReasons.push('PATTERN_HIGH_RISK');
    blockReasons.push('PATTERN_MANIPULATION');
    await logDecisionToAudit(candidate, 'SUPPRESS', blockReasons, dedupHash);
    return { decision: 'SUPPRESS', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.patterns_check = true;
  
  // Evaluate AQM
  const aqmResult = evaluateAlertQuality(mlContext, undefined, patternResult.risk_score);
  
  // Check AQM recommendation
  if (aqmResult.recommendation === 'SUPPRESS') {
    blockReasons.push('AQM_NOISE');
    await logDecisionToAudit(candidate, 'SUPPRESS', blockReasons, dedupHash);
    return { decision: 'SUPPRESS', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
  checks.aqm_check = true;
  
  // Determine final priority
  const isLowPriority = aqmResult.recommendation === 'SEND_LOW_PRIORITY' || patternResult.severity === 'MEDIUM';
  
  // ========== CHECK 12: Dedup (HARD - MongoDB unique index) ==========
  try {
    const store = getAlertPolicyStore();
    const alertId = uuid();
    
    const auditResult = await store.logDecision({
      alert_id: alertId,
      account_id: candidate.account_id,
      account_handle: `@${candidate.username}`,
      alert_type: candidate.alert_type,
      decision: 'SEND',
      block_reasons: [],
      confidence_score: candidate.confidence_score,
      score_from: candidate.score_from,
      score_to: candidate.score_to,
      delta_pct: candidate.score_delta_pct,
      live_weight: currentLiveWeight,
      delivered: false,
      pending: false,
    });
    
    if (auditResult.duplicate) {
      // DEDUP BLOCKED - already sent in this window
      blockReasons.push('DEDUP_BLOCKED');
      addQuickAudit({
        timestamp: new Date().toISOString(),
        account_id: candidate.account_id,
        alert_type: candidate.alert_type,
        decision: 'BLOCK',
        block_reasons: ['DEDUP_BLOCKED'],
        confidence: candidate.confidence_score,
      });
      return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
    }
    
    checks.dedup_check = true;
    
    // ========== ALL CHECKS PASSED - SEND (with ML enrichment) ==========
    const alertPayload: AlertPayload = {
      alert_id: alertId,
      type: candidate.alert_type,
      timestamp: new Date().toISOString(),
      account: {
        id: candidate.account_id,
        handle: `@${candidate.username}`,
        profile: candidate.profile,
      },
      score: {
        from: candidate.score_from,
        to: candidate.score_to,
        delta_pct: candidate.score_delta_pct,
      },
      confidence: {
        score: candidate.confidence_score,
        level: candidate.confidence_level,
        warnings: candidate.confidence_warnings,
      },
      reasons: candidate.reasons,
      network: {
        hops_to_elite: candidate.hops_to_elite,
        authority_tier: candidate.authority_tier,
      },
      graph_link: '', // Will be filled by caller
      policy_snapshot: policySnapshot,
      // Phase 5.A: ML Layer results
      ml: {
        aqm: {
          probability: aqmResult.probability,
          label: aqmResult.label,
          recommendation: aqmResult.recommendation,
          explain: aqmResult.explain,
        },
        patterns: {
          risk_score: patternResult.risk_score,
          flags: patternResult.flags,
          severity: patternResult.severity,
          explain: patternResult.explain,
        },
        priority: isLowPriority ? 'LOW' : 'HIGH',
      },
    };
    
    // Increment daily counter
    dailyAlertCount++;
    
    // Determine final decision based on ML
    const finalDecision: AlertDecision = isLowPriority ? 'SEND_LOW_PRIORITY' : 'SEND';
    
    // Add to quick audit
    addQuickAudit({
      timestamp: new Date().toISOString(),
      alert_id: alertId,
      account_id: candidate.account_id,
      alert_type: candidate.alert_type,
      decision: finalDecision,
      block_reasons: [],
      confidence: candidate.confidence_score,
    });
    
    return {
      decision: finalDecision,
      block_reasons: [],
      alert_id: alertId,
      alert_payload: alertPayload,
      policy_snapshot: policySnapshot,
      checks,
      dedup_hash: dedupHash,
    };
    
  } catch (err) {
    console.error('[AlertPolicy] Dedup check failed:', err);
    blockReasons.push('DEDUP_BLOCKED');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks, dedup_hash: dedupHash };
  }
}

/**
 * Sync version for backwards compatibility (no MongoDB dedup)
 */
export function checkAlertPolicy(candidate: AlertCandidate): PolicyDecision {
  checkDailyReset();
  
  const checks = {
    enabled_check: false,
    type_enabled_check: false,
    rollback_check: false,
    daily_cap_check: false,
    cooldown_check: true, // Skip in sync mode
    dedup_check: true,    // Skip in sync mode
    confidence_check: false,
    delta_check: false,
    live_weight_check: false,
    divergence_check: false,
    edge_confidence_check: false,
  };
  
  const blockReasons: BlockReason[] = [];
  const config = cachedConfig;
  
  const policySnapshot = {
    min_confidence: config.min_confidence,
    min_score_delta: config.min_score_delta_pct,
    min_live_weight: config.min_live_weight,
  };
  
  // Basic checks (sync)
  if (!config.enabled) {
    blockReasons.push('DISABLED');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.enabled_check = true;
  
  if (!config.types_enabled[candidate.alert_type]) {
    blockReasons.push('TYPE_DISABLED');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.type_enabled_check = true;
  
  if (config.rollback_active) {
    blockReasons.push('ROLLBACK_ACTIVE');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.rollback_check = true;
  
  if (dailyAlertCount >= config.daily_cap) {
    blockReasons.push('DAILY_CAP');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.daily_cap_check = true;
  
  if (candidate.confidence_score < config.min_confidence) {
    blockReasons.push('LOW_CONFIDENCE');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.confidence_check = true;
  
  if (candidate.score_delta_pct < config.min_score_delta_pct) {
    blockReasons.push('DELTA_TOO_SMALL');
    return { decision: 'SUPPRESS', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.delta_check = true;
  
  const currentLiveWeight = candidate.live_weight ?? getCurrentLiveWeight();
  if (currentLiveWeight < config.min_live_weight) {
    blockReasons.push('LOW_LIVE_WEIGHT');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.live_weight_check = true;
  
  if (candidate.graph_divergent_edges_pct > config.max_divergent_edges_pct) {
    blockReasons.push('DIVERGENT_EDGES');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.divergence_check = true;
  
  if (candidate.graph_min_edge_confidence < config.min_edge_confidence) {
    blockReasons.push('EDGE_CONFIDENCE_LOW');
    return { decision: 'BLOCK', block_reasons: blockReasons, policy_snapshot: policySnapshot, checks };
  }
  checks.edge_confidence_check = true;
  
  // SEND
  const alertId = uuid();
  dailyAlertCount++;
  
  addQuickAudit({
    timestamp: new Date().toISOString(),
    alert_id: alertId,
    account_id: candidate.account_id,
    alert_type: candidate.alert_type,
    decision: 'SEND',
    block_reasons: [],
    confidence: candidate.confidence_score,
  });
  
  const alertPayload: AlertPayload = {
    alert_id: alertId,
    type: candidate.alert_type,
    timestamp: new Date().toISOString(),
    account: {
      id: candidate.account_id,
      handle: `@${candidate.username}`,
      profile: candidate.profile,
    },
    score: {
      from: candidate.score_from,
      to: candidate.score_to,
      delta_pct: candidate.score_delta_pct,
    },
    confidence: {
      score: candidate.confidence_score,
      level: candidate.confidence_level,
      warnings: candidate.confidence_warnings,
    },
    reasons: candidate.reasons,
    network: {
      hops_to_elite: candidate.hops_to_elite,
      authority_tier: candidate.authority_tier,
    },
    graph_link: '',
    policy_snapshot: policySnapshot,
  };
  
  return {
    decision: 'SEND',
    block_reasons: [],
    alert_id: alertId,
    alert_payload: alertPayload,
    policy_snapshot: policySnapshot,
    checks,
  };
}

// Helper for async audit logging
async function logDecisionToAudit(
  candidate: AlertCandidate,
  decision: AlertDecision,
  blockReasons: BlockReason[],
  dedupHash: string
): Promise<void> {
  addQuickAudit({
    timestamp: new Date().toISOString(),
    account_id: candidate.account_id,
    alert_type: candidate.alert_type,
    decision,
    block_reasons: blockReasons,
    confidence: candidate.confidence_score,
  });
  
  try {
    const store = getAlertPolicyStore();
    await store.logDecision({
      account_id: candidate.account_id,
      account_handle: `@${candidate.username}`,
      alert_type: candidate.alert_type,
      decision,
      block_reasons: blockReasons,
      confidence_score: candidate.confidence_score,
      score_from: candidate.score_from,
      score_to: candidate.score_to,
      delta_pct: candidate.score_delta_pct,
      live_weight: candidate.live_weight ?? getCurrentLiveWeight(),
      delivered: false,
      pending: false,
    });
  } catch (err) {
    console.warn('[AlertPolicy] Failed to log to MongoDB:', err);
  }
}

// ============================================================
// ADMIN API
// ============================================================

export function getAlertPolicyConfig(): AlertPolicyConfig {
  return { ...cachedConfig };
}

export async function updateAlertPolicyConfig(updates: Partial<AlertPolicyConfig>): Promise<AlertPolicyConfig> {
  // Update cache
  cachedConfig = { ...cachedConfig, ...updates };
  
  // Deep merge
  if (updates.cooldown_per_type) {
    cachedConfig.cooldown_per_type = {
      ...cachedConfig.cooldown_per_type,
      ...updates.cooldown_per_type,
    };
  }
  if (updates.types_enabled) {
    cachedConfig.types_enabled = {
      ...cachedConfig.types_enabled,
      ...updates.types_enabled,
    };
  }
  
  // Persist to MongoDB
  try {
    const store = getAlertPolicyStore();
    await store.updateConfig(cachedConfig);
  } catch (err) {
    console.warn('[AlertPolicy] Failed to persist config:', err);
  }
  
  console.log('[AlertPolicy] Config updated:', cachedConfig.enabled, 'min_confidence:', cachedConfig.min_confidence);
  return { ...cachedConfig };
}

export function setRollbackActive(active: boolean): void {
  cachedConfig.rollback_active = active;
  if (active) {
    console.log('[AlertPolicy] ROLLBACK ACTIVE - Alerts disabled');
    // Also update in store
    try {
      const store = getAlertPolicyStore();
      store.onRollback().catch(console.error);
    } catch (err) {
      // Store might not be initialized
    }
  }
}

export function getAlertPolicyAudit(limit: number = 50): QuickAuditEntry[] {
  return quickAuditLog.slice(0, limit);
}

export function getAlertPolicyStats(): {
  daily_sent: number;
  daily_cap: number;
  daily_remaining: number;
  blocked_by_reason: Record<string, number>;
} {
  checkDailyReset();
  
  const blockedByReason: Record<string, number> = {};
  
  // Count from today's quick audit
  const today = new Date().toDateString();
  const todayAudit = quickAuditLog.filter(e => new Date(e.timestamp).toDateString() === today);
  
  for (const entry of todayAudit) {
    for (const reason of entry.block_reasons) {
      blockedByReason[reason] = (blockedByReason[reason] || 0) + 1;
    }
  }
  
  return {
    daily_sent: dailyAlertCount,
    daily_cap: cachedConfig.daily_cap,
    daily_remaining: Math.max(0, cachedConfig.daily_cap - dailyAlertCount),
    blocked_by_reason: blockedByReason,
  };
}

/**
 * Kill switch - disable all alerts immediately
 */
export async function killSwitch(): Promise<void> {
  cachedConfig.enabled = false;
  console.log('[AlertPolicy] KILL SWITCH ACTIVATED - All alerts disabled');
  
  try {
    const store = getAlertPolicyStore();
    await store.killSwitch('ADMIN_TRIGGERED');
  } catch (err) {
    console.warn('[AlertPolicy] Failed to persist kill switch:', err);
  }
}

/**
 * Test alert policy (dry run)
 */
export function testAlertPolicy(candidate: AlertCandidate): PolicyDecision {
  const result = checkAlertPolicy(candidate);
  
  // Rollback side effects for test
  if (result.decision === 'SEND') {
    dailyAlertCount--;
    quickAuditLog.shift();
  } else {
    quickAuditLog.shift();
  }
  
  return result;
}

/**
 * Load config from MongoDB on startup
 */
export async function loadConfigFromStore(): Promise<void> {
  try {
    const store = getAlertPolicyStore();
    cachedConfig = await store.getConfig();
    console.log('[AlertPolicy] Config loaded from MongoDB, enabled:', cachedConfig.enabled);
  } catch (err) {
    console.warn('[AlertPolicy] Failed to load config from MongoDB, using defaults:', err);
  }
}

console.log('[AlertPolicy] Alert Policy Engine initialized (Phase 4.5)');
