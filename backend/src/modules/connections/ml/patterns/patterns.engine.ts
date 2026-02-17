/**
 * Pattern Detection Engine (Phase 5.2)
 * 
 * Detects manipulation patterns A/B/C:
 * A) Like/Reply Imbalance (like farming)
 * B) Spike Pump (artificial engagement)
 * C) Cross-Audience Farm (overlap manipulation)
 */

import type { PatternInput, PatternResult, PatternFlag, PatternSeverity } from './patterns.types.js';
import { type PatternsConfig, DEFAULT_PATTERNS_CONFIG } from './patterns.config.js';

interface PatternCheck {
  flag: PatternFlag;
  triggered: boolean;
  risk_contribution: number;
  explain: string;
}

/**
 * Pattern A: Like/Reply Imbalance
 * Detects when likes grow but replies/reposts are missing
 */
function checkLikeImbalance(input: PatternInput, cfg: PatternsConfig): PatternCheck {
  if (!cfg.imbalance.enabled) {
    return { flag: 'LIKE_FARM', triggered: false, risk_contribution: 0, explain: '' };
  }
  
  const denominator = input.replies + input.reposts + 1;
  const ratio = input.likes / denominator;
  
  const triggered = ratio > cfg.imbalance.threshold && input.likes >= cfg.imbalance.min_likes;
  const risk = triggered ? Math.min(40, (ratio / cfg.imbalance.threshold) * 20) : 0;
  
  return {
    flag: 'LIKE_FARM',
    triggered,
    risk_contribution: risk,
    explain: triggered 
      ? `Like/Reply imbalance detected: ${input.likes} likes vs ${input.replies + input.reposts} interactions (ratio ${ratio.toFixed(1)}x)`
      : '',
  };
}

/**
 * Pattern B: Spike Pump
 * Detects engagement spikes far above normal window
 */
function checkSpikePump(input: PatternInput, cfg: PatternsConfig): PatternCheck {
  if (!cfg.spike.enabled || !input.engagement_history || input.engagement_history.length < 7) {
    return { flag: 'SPIKE_PUMP', triggered: false, risk_contribution: 0, explain: '' };
  }
  
  const history = input.engagement_history;
  const current = input.engagement_rate;
  
  // Calculate median and MAD
  const sorted = [...history].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = history.map(x => Math.abs(x - median));
  const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)] || 1;
  
  const z = (current - median) / (mad + 0.01);
  
  const triggered = z > cfg.spike.z_threshold && current >= cfg.spike.min_engagement;
  const risk = triggered ? Math.min(35, z * 10) : 0;
  
  return {
    flag: 'SPIKE_PUMP',
    triggered,
    risk_contribution: risk,
    explain: triggered
      ? `Engagement spike detected: ${current.toFixed(1)} vs median ${median.toFixed(1)} (z=${z.toFixed(1)})`
      : '',
  };
}

/**
 * Pattern C: Cross-Audience Farm (Overlap)
 * Detects high overlap pressure with low purity
 */
function checkOverlapFarm(input: PatternInput, cfg: PatternsConfig): PatternCheck {
  if (!cfg.overlap.enabled) {
    return { flag: 'OVERLAP_FARM', triggered: false, risk_contribution: 0, explain: '' };
  }
  
  const triggered = input.overlap_pressure > cfg.overlap.pressure_threshold && 
                    input.audience_purity < cfg.overlap.purity_min;
  
  const risk = triggered 
    ? Math.min(35, (input.overlap_pressure / cfg.overlap.pressure_threshold) * 15 + 
               ((cfg.overlap.purity_min - input.audience_purity) / 50) * 20)
    : 0;
  
  return {
    flag: 'OVERLAP_FARM',
    triggered,
    risk_contribution: risk,
    explain: triggered
      ? `Cross-audience farm detected: overlap ${(input.overlap_pressure * 100).toFixed(0)}%, purity ${input.audience_purity.toFixed(0)}%`
      : '',
  };
}

/**
 * Determine severity from risk score
 */
function getSeverity(riskScore: number, cfg: PatternsConfig): PatternSeverity {
  if (riskScore >= cfg.severity.high_risk) return 'HIGH';
  if (riskScore >= cfg.severity.medium_risk) return 'MEDIUM';
  return 'LOW';
}

/**
 * Get recommended actions based on severity
 */
function getRecommendedActions(severity: PatternSeverity): PatternResult['recommended_actions'] {
  switch (severity) {
    case 'HIGH':
      return ['SUPPRESS_ALERTS', 'DEGRADE_CONFIDENCE'];
    case 'MEDIUM':
      return ['DEGRADE_CONFIDENCE', 'REQUIRE_MORE_DATA'];
    case 'LOW':
      return ['NONE'];
  }
}

/**
 * Main pattern detection function
 */
export function detectPatterns(
  input: PatternInput,
  cfg: PatternsConfig = DEFAULT_PATTERNS_CONFIG
): PatternResult {
  if (!cfg.enabled) {
    return {
      risk_score: 0,
      flags: [],
      severity: 'LOW',
      explain: [],
      recommended_actions: ['NONE'],
    };
  }
  
  // Run all pattern checks
  const checks: PatternCheck[] = [
    checkLikeImbalance(input, cfg),
    checkSpikePump(input, cfg),
    checkOverlapFarm(input, cfg),
  ];
  
  // Aggregate results
  const triggeredChecks = checks.filter(c => c.triggered);
  const flags = triggeredChecks.map(c => c.flag);
  const totalRisk = Math.min(100, triggeredChecks.reduce((sum, c) => sum + c.risk_contribution, 0));
  const explanations = triggeredChecks.map(c => c.explain).filter(e => e);
  
  const severity = getSeverity(totalRisk, cfg);
  const actions = getRecommendedActions(severity);
  
  return {
    risk_score: Math.round(totalRisk),
    flags,
    severity,
    explain: explanations,
    recommended_actions: actions,
  };
}

console.log('[Patterns] Pattern Detection Engine loaded (Phase 5.2)');
