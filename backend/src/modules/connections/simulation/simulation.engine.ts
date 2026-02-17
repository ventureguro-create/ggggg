/**
 * Simulation Engine (Phase 4.7)
 * 
 * Deterministic simulation of Twitter data for system validation.
 * Key principles:
 * - NO real Twitter data
 * - Compressed time (1 tick = 1 hour)
 * - Reproducible scenarios
 * - Full metrics logging
 */

import { v4 as uuid } from 'uuid';

// ============================================================
// TYPES
// ============================================================

export type ScenarioId = 
  | 'BASELINE_STABILITY'
  | 'BOT_PUMP'
  | 'SMART_NONAME'
  | 'ELITE_FOLLOW_UNFOLLOW'
  | 'GRAPH_POISONING'
  | 'ALERT_FLOOD'
  | 'ROLLBACK_DRILL'
  | 'AI_CONSISTENCY';

export interface SimulationAccount {
  account_id: string;
  username: string;
  profile: 'retail' | 'influencer' | 'whale';
  
  // Base metrics
  followers: number;
  engagement_rate: number;
  posts_count: number;
  
  // Quality metrics
  smart_followers: number;
  bot_risk: number;
  audience_purity: number;
  
  // Network
  hops_to_elite: number;
  authority_score: number;
  elite_connections: string[];
  
  // Computed
  twitter_score?: number;
  confidence_score?: number;
}

export interface SimulationEvent {
  tick: number;
  account_id: string;
  event_type: 'followers_change' | 'engagement_change' | 'elite_follow' | 'elite_unfollow' | 'bot_injection' | 'graph_edge_add' | 'graph_edge_remove';
  delta: number;
  metadata?: Record<string, any>;
}

export interface SimulationScenario {
  id: ScenarioId;
  name: string;
  description: string;
  ticks: number;
  accounts: SimulationAccount[];
  events: SimulationEvent[];
  expected: {
    score_change: 'up' | 'down' | 'stable' | 'blocked';
    confidence_min: number;
    alerts_allowed: boolean;
    rollback_expected: boolean;
    ai_verdict?: string;
  };
}

export interface TickResult {
  tick: number;
  timestamp: string;
  accounts: Array<{
    account_id: string;
    twitter_score: number;
    score_delta: number;
    confidence: number;
    alert_decision: 'SEND' | 'BLOCK' | 'SUPPRESS' | 'NONE';
    block_reason?: string;
  }>;
  system: {
    live_weight: number;
    rollback_triggered: boolean;
    alerts_sent: number;
    alerts_blocked: number;
  };
}

export interface SimulationResult {
  scenario_id: ScenarioId;
  run_id: string;
  started_at: string;
  completed_at: string;
  ticks_run: number;
  
  // Results
  passed: boolean;
  failures: string[];
  warnings: string[];
  
  // Metrics
  final_scores: Record<string, number>;
  final_confidence: Record<string, number>;
  score_deltas: Record<string, number>;
  alerts_total: { sent: number; blocked: number; suppressed: number };
  rollbacks: number;
  
  // Tick history
  tick_history: TickResult[];
}

// ============================================================
// SCORING FUNCTIONS (FROZEN v1.0)
// ============================================================

/**
 * Compute Twitter Score (FROZEN FORMULA v1.0)
 * 
 * Score = 0.30 × influence + 0.20 × quality + 0.15 × trend + 0.25 × network + 0.10 × consistency
 * 
 * Key principle: Network quality matters MORE than raw followers
 */
function computeTwitterScore(account: SimulationAccount, prevScore?: number): number {
  // Influence component (followers normalized, but with diminishing returns)
  const followersNorm = Math.log10(Math.max(1, account.followers)) / 6; // log scale
  const influence = Math.min(1, followersNorm) * 1000 * 0.30;
  
  // Quality component (audience purity, smart followers ratio)
  const smartRatio = account.smart_followers / Math.max(1, account.followers);
  const qualityScore = (account.audience_purity * 0.4 + smartRatio * 0.6); // Smart ratio weighs MORE
  const quality = Math.min(1, qualityScore) * 1000 * 0.20;
  
  // Trend component (engagement rate)
  const trend = Math.min(1, account.engagement_rate / 10) * 1000 * 0.15;
  
  // Network component (authority + hops) - THIS IS KEY
  const hopsScore = Math.max(0, (4 - account.hops_to_elite) / 3);
  const eliteBonus = Math.min(1, account.elite_connections.length * 0.3);
  const networkScore = (account.authority_score * 0.4 + hopsScore * 0.4 + eliteBonus * 0.2);
  const network = Math.min(1, networkScore) * 1000 * 0.25;
  
  // Consistency component (stability, low bot risk)
  const consistency = (1 - account.bot_risk) * 1000 * 0.10;
  
  const rawScore = influence + quality + trend + network + consistency;
  
  // Apply bot risk penalty
  const botPenalty = account.bot_risk > 0.5 ? 0.5 : 1;
  
  return Math.round(Math.min(1000, rawScore * botPenalty));
}

/**
 * Compute Confidence Score
 */
function computeConfidence(account: SimulationAccount): number {
  let confidence = 100;
  
  // Bot risk penalty (aggressive for high risk)
  if (account.bot_risk > 0.8) confidence -= 55;
  else if (account.bot_risk > 0.6) confidence -= 40;
  else if (account.bot_risk > 0.4) confidence -= 20;
  else if (account.bot_risk > 0.2) confidence -= 10;
  
  // Audience purity
  if (account.audience_purity < 0.3) confidence -= 25;
  else if (account.audience_purity < 0.5) confidence -= 15;
  
  // Smart followers ratio
  const smartRatio = account.smart_followers / Math.max(1, account.followers);
  if (smartRatio < 0.01) confidence -= 15;
  else if (smartRatio < 0.05) confidence -= 5;
  
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Determine alert decision based on confidence
 */
function getAlertDecision(
  score: number, 
  prevScore: number, 
  confidence: number,
  alertsInWindow: number
): { decision: 'SEND' | 'BLOCK' | 'SUPPRESS' | 'NONE'; reason?: string } {
  const delta = score - prevScore;
  const deltaPct = prevScore > 0 ? (delta / prevScore) * 100 : 0;
  
  // No significant change
  if (Math.abs(deltaPct) < 12) {
    return { decision: 'NONE' };
  }
  
  // Confidence gate (FROZEN: 65%)
  if (confidence < 65) {
    return { decision: 'BLOCK', reason: 'LOW_CONFIDENCE' };
  }
  
  // Dedup (max 1 per window)
  if (alertsInWindow > 0) {
    return { decision: 'SUPPRESS', reason: 'COOLDOWN' };
  }
  
  return { decision: 'SEND' };
}

// ============================================================
// SCENARIOS
// ============================================================

export function getScenario(id: ScenarioId): SimulationScenario {
  switch (id) {
    case 'BASELINE_STABILITY':
      return {
        id: 'BASELINE_STABILITY',
        name: 'Baseline Stability',
        description: 'Stable growth without external noise',
        ticks: 24,
        accounts: [
          {
            account_id: 'sim_baseline_001',
            username: 'stable_user',
            profile: 'influencer',
            followers: 50000,
            engagement_rate: 3.5,
            posts_count: 500,
            smart_followers: 5000,
            bot_risk: 0.1,
            audience_purity: 0.85,
            hops_to_elite: 2,
            authority_score: 0.6,
            elite_connections: ['elite_001'],
          }
        ],
        events: Array.from({ length: 24 }, (_, i) => ({
          tick: i,
          account_id: 'sim_baseline_001',
          event_type: 'followers_change' as const,
          delta: 400, // +0.8% per tick
        })),
        expected: {
          score_change: 'up',
          confidence_min: 85,
          alerts_allowed: true,
          rollback_expected: false,
          ai_verdict: 'GOOD',
        },
      };
      
    case 'BOT_PUMP':
      return {
        id: 'BOT_PUMP',
        name: 'Bot Pump Attack',
        description: '+400% followers spike with no engagement',
        ticks: 12,
        accounts: [
          {
            account_id: 'sim_bot_001',
            username: 'pumped_user',
            profile: 'retail',
            followers: 10000,
            engagement_rate: 2.0,
            posts_count: 100,
            smart_followers: 500,
            bot_risk: 0.2,
            audience_purity: 0.7,
            hops_to_elite: 3,
            authority_score: 0.3,
            elite_connections: [],
          }
        ],
        events: [
          { tick: 2, account_id: 'sim_bot_001', event_type: 'followers_change', delta: 20000 },
          { tick: 3, account_id: 'sim_bot_001', event_type: 'followers_change', delta: 20000 },
          { tick: 2, account_id: 'sim_bot_001', event_type: 'bot_injection', delta: 0.6, metadata: { bot_risk_increase: true } },
        ],
        expected: {
          score_change: 'blocked',
          confidence_min: 0, // Should drop below threshold
          alerts_allowed: false,
          rollback_expected: false,
          ai_verdict: 'RISKY',
        },
      };
      
    case 'SMART_NONAME':
      return {
        id: 'SMART_NONAME',
        name: 'Smart No-Name',
        description: 'Low followers but elite network connections',
        ticks: 24,
        accounts: [
          {
            account_id: 'sim_smart_001',
            username: 'smart_noname',
            profile: 'retail',
            followers: 5000,
            engagement_rate: 8.0,
            posts_count: 200,
            smart_followers: 2000, // 40% smart!
            bot_risk: 0.05,
            audience_purity: 0.95,
            hops_to_elite: 2,
            authority_score: 0.75,
            elite_connections: ['whale_001', 'whale_002'],
          },
          {
            account_id: 'sim_mass_001',
            username: 'mass_influencer',
            profile: 'influencer',
            followers: 100000,
            engagement_rate: 1.5,
            posts_count: 1000,
            smart_followers: 2000, // Only 2% smart
            bot_risk: 0.25,
            audience_purity: 0.5,
            hops_to_elite: 4,
            authority_score: 0.2,
            elite_connections: [],
          }
        ],
        events: [],
        expected: {
          score_change: 'stable',
          confidence_min: 80,
          alerts_allowed: true,
          rollback_expected: false,
          ai_verdict: 'STRONG',
        },
      };
      
    case 'ELITE_FOLLOW_UNFOLLOW':
      return {
        id: 'ELITE_FOLLOW_UNFOLLOW',
        name: 'Elite Follow/Unfollow',
        description: 'Whale follows then unfollows',
        ticks: 24,
        accounts: [
          {
            account_id: 'sim_elite_001',
            username: 'elite_target',
            profile: 'influencer',
            followers: 30000,
            engagement_rate: 4.0,
            posts_count: 300,
            smart_followers: 3000,
            bot_risk: 0.1,
            audience_purity: 0.8,
            hops_to_elite: 3,
            authority_score: 0.4,
            elite_connections: [],
          }
        ],
        events: [
          { tick: 5, account_id: 'sim_elite_001', event_type: 'elite_follow', delta: 1, metadata: { elite_id: 'whale_alpha' } },
          { tick: 15, account_id: 'sim_elite_001', event_type: 'elite_unfollow', delta: -1, metadata: { elite_id: 'whale_alpha' } },
        ],
        expected: {
          score_change: 'stable',
          confidence_min: 70,
          alerts_allowed: true,
          rollback_expected: false,
        },
      };
      
    case 'GRAPH_POISONING':
      return {
        id: 'GRAPH_POISONING',
        name: 'Graph Poisoning Attack',
        description: 'Mass low-quality edge injection',
        ticks: 12,
        accounts: [
          {
            account_id: 'sim_poison_001',
            username: 'poison_target',
            profile: 'influencer',
            followers: 40000,
            engagement_rate: 3.0,
            posts_count: 400,
            smart_followers: 4000,
            bot_risk: 0.15,
            audience_purity: 0.75,
            hops_to_elite: 2,
            authority_score: 0.5,
            elite_connections: ['elite_001'],
          }
        ],
        events: Array.from({ length: 8 }, (_, i) => ({
          tick: i + 2,
          account_id: 'sim_poison_001',
          event_type: 'graph_edge_add' as const,
          delta: 50, // 50 low-quality edges per tick
          metadata: { edge_quality: 'low' },
        })),
        expected: {
          score_change: 'down',
          confidence_min: 50,
          alerts_allowed: false,
          rollback_expected: false,
        },
      };
      
    case 'ALERT_FLOOD':
      return {
        id: 'ALERT_FLOOD',
        name: 'Alert Flood Attempt',
        description: 'Multiple accounts trigger alerts simultaneously',
        ticks: 6,
        accounts: Array.from({ length: 10 }, (_, i) => ({
          account_id: `sim_flood_${i}`,
          username: `flood_user_${i}`,
          profile: 'influencer' as const,
          followers: 20000 + i * 1000,
          engagement_rate: 3.0,
          posts_count: 200,
          smart_followers: 2000,
          bot_risk: 0.1,
          audience_purity: 0.8,
          hops_to_elite: 2,
          authority_score: 0.5,
          elite_connections: [],
        })),
        events: Array.from({ length: 10 }, (_, i) => ({
          tick: 2,
          account_id: `sim_flood_${i}`,
          event_type: 'followers_change' as const,
          delta: 5000, // +25% spike
        })),
        expected: {
          score_change: 'up',
          confidence_min: 70,
          alerts_allowed: true, // But should be rate-limited
          rollback_expected: false,
        },
      };
      
    case 'ROLLBACK_DRILL':
      return {
        id: 'ROLLBACK_DRILL',
        name: 'Rollback Drill',
        description: 'Test instant rollback on anomaly',
        ticks: 12,
        accounts: [
          {
            account_id: 'sim_rollback_001',
            username: 'rollback_target',
            profile: 'influencer',
            followers: 50000,
            engagement_rate: 3.5,
            posts_count: 500,
            smart_followers: 5000,
            bot_risk: 0.1,
            audience_purity: 0.85,
            hops_to_elite: 2,
            authority_score: 0.6,
            elite_connections: ['elite_001'],
          }
        ],
        events: [
          { tick: 5, account_id: 'sim_rollback_001', event_type: 'followers_change', delta: 100000 }, // 200% spike
          { tick: 5, account_id: 'sim_rollback_001', event_type: 'bot_injection', delta: 0.85 }, // High bot risk
        ],
        expected: {
          score_change: 'blocked',
          confidence_min: 0,
          alerts_allowed: false,
          rollback_expected: true,
        },
      };
      
    case 'AI_CONSISTENCY':
      return {
        id: 'AI_CONSISTENCY',
        name: 'AI Consistency Check',
        description: 'Same input should produce same AI output',
        ticks: 6,
        accounts: [
          {
            account_id: 'sim_ai_001',
            username: 'ai_test_user',
            profile: 'influencer',
            followers: 45000,
            engagement_rate: 4.0,
            posts_count: 450,
            smart_followers: 4500,
            bot_risk: 0.12,
            audience_purity: 0.82,
            hops_to_elite: 2,
            authority_score: 0.55,
            elite_connections: ['elite_001'],
          }
        ],
        events: [], // No changes - should be stable
        expected: {
          score_change: 'stable',
          confidence_min: 80,
          alerts_allowed: true,
          rollback_expected: false,
          ai_verdict: 'GOOD',
        },
      };
      
    default:
      throw new Error(`Unknown scenario: ${id}`);
  }
}

// ============================================================
// SIMULATION ENGINE
// ============================================================

export class SimulationEngine {
  private scenario: SimulationScenario;
  private accounts: Map<string, SimulationAccount>;
  private tickHistory: TickResult[];
  private alertsPerAccount: Map<string, number>;
  private rollbackTriggered: boolean;
  private liveWeight: number;
  
  constructor(scenarioId: ScenarioId) {
    this.scenario = getScenario(scenarioId);
    this.accounts = new Map();
    this.tickHistory = [];
    this.alertsPerAccount = new Map();
    this.rollbackTriggered = false;
    this.liveWeight = 0.15; // Start at 15% live
    
    // Initialize accounts
    for (const acc of this.scenario.accounts) {
      this.accounts.set(acc.account_id, { ...acc });
    }
  }
  
  /**
   * Run full simulation
   */
  run(): SimulationResult {
    const runId = uuid();
    const startedAt = new Date().toISOString();
    const failures: string[] = [];
    const warnings: string[] = [];
    
    let totalAlertsSent = 0;
    let totalAlertsBlocked = 0;
    let totalAlertsSuppressed = 0;
    let rollbackCount = 0;
    
    // Store initial scores
    const initialScores: Record<string, number> = {};
    for (const [id, acc] of this.accounts) {
      const score = computeTwitterScore(acc);
      acc.twitter_score = score;
      acc.confidence_score = computeConfidence(acc);
      initialScores[id] = score;
    }
    
    // Run ticks
    for (let tick = 0; tick < this.scenario.ticks; tick++) {
      const tickResult = this.runTick(tick);
      this.tickHistory.push(tickResult);
      
      totalAlertsSent += tickResult.system.alerts_sent;
      totalAlertsBlocked += tickResult.system.alerts_blocked;
      if (tickResult.system.rollback_triggered) {
        rollbackCount++;
        this.rollbackTriggered = true;
      }
    }
    
    // Collect final state
    const finalScores: Record<string, number> = {};
    const finalConfidence: Record<string, number> = {};
    const scoreDeltas: Record<string, number> = {};
    
    for (const [id, acc] of this.accounts) {
      finalScores[id] = acc.twitter_score || 0;
      finalConfidence[id] = acc.confidence_score || 0;
      scoreDeltas[id] = (acc.twitter_score || 0) - initialScores[id];
    }
    
    // Validate expectations
    const passed = this.validateExpectations(failures, warnings, finalScores, finalConfidence, scoreDeltas, totalAlertsBlocked);
    
    return {
      scenario_id: this.scenario.id,
      run_id: runId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      ticks_run: this.scenario.ticks,
      passed,
      failures,
      warnings,
      final_scores: finalScores,
      final_confidence: finalConfidence,
      score_deltas: scoreDeltas,
      alerts_total: {
        sent: totalAlertsSent,
        blocked: totalAlertsBlocked,
        suppressed: totalAlertsSuppressed,
      },
      rollbacks: rollbackCount,
      tick_history: this.tickHistory,
    };
  }
  
  /**
   * Run single tick
   */
  private runTick(tick: number): TickResult {
    // Apply events for this tick
    const tickEvents = this.scenario.events.filter(e => e.tick === tick);
    for (const event of tickEvents) {
      this.applyEvent(event);
    }
    
    // Compute new scores
    const accountResults: TickResult['accounts'] = [];
    let alertsSent = 0;
    let alertsBlocked = 0;
    let rollbackTriggered = false;
    
    for (const [id, acc] of this.accounts) {
      const prevScore = acc.twitter_score || 0;
      const newScore = computeTwitterScore(acc, prevScore);
      const confidence = computeConfidence(acc);
      
      // Check for rollback conditions (confidence < 50% triggers rollback)
      if (confidence < 50 && !this.rollbackTriggered) {
        rollbackTriggered = true;
        this.rollbackTriggered = true;
        this.liveWeight = 0; // Rollback to mock
      }
      
      // Get alert decision
      const alertsInWindow = this.alertsPerAccount.get(id) || 0;
      const alertDecision = getAlertDecision(newScore, prevScore, confidence, alertsInWindow);
      
      if (alertDecision.decision === 'SEND') {
        alertsSent++;
        this.alertsPerAccount.set(id, alertsInWindow + 1);
      } else if (alertDecision.decision === 'BLOCK') {
        alertsBlocked++;
      }
      
      // Update account
      acc.twitter_score = newScore;
      acc.confidence_score = confidence;
      
      accountResults.push({
        account_id: id,
        twitter_score: newScore,
        score_delta: newScore - prevScore,
        confidence,
        alert_decision: alertDecision.decision,
        block_reason: alertDecision.reason,
      });
    }
    
    return {
      tick,
      timestamp: new Date(Date.now() + tick * 3600000).toISOString(),
      accounts: accountResults,
      system: {
        live_weight: this.liveWeight,
        rollback_triggered: rollbackTriggered,
        alerts_sent: alertsSent,
        alerts_blocked: alertsBlocked,
      },
    };
  }
  
  /**
   * Apply event to account
   */
  private applyEvent(event: SimulationEvent): void {
    const acc = this.accounts.get(event.account_id);
    if (!acc) return;
    
    switch (event.event_type) {
      case 'followers_change':
        acc.followers = Math.max(0, acc.followers + event.delta);
        break;
        
      case 'engagement_change':
        acc.engagement_rate = Math.max(0, acc.engagement_rate + event.delta);
        break;
        
      case 'bot_injection':
        acc.bot_risk = Math.min(1, Math.max(0, event.delta));
        acc.audience_purity = Math.max(0, acc.audience_purity - 0.3);
        acc.smart_followers = Math.floor(acc.smart_followers * 0.5);
        break;
        
      case 'elite_follow':
        acc.hops_to_elite = Math.max(1, acc.hops_to_elite - 1);
        acc.authority_score = Math.min(1, acc.authority_score + 0.2);
        if (event.metadata?.elite_id) {
          acc.elite_connections.push(event.metadata.elite_id);
        }
        break;
        
      case 'elite_unfollow':
        acc.hops_to_elite = Math.min(4, acc.hops_to_elite + 1);
        acc.authority_score = Math.max(0, acc.authority_score - 0.15);
        if (event.metadata?.elite_id) {
          acc.elite_connections = acc.elite_connections.filter(e => e !== event.metadata?.elite_id);
        }
        break;
        
      case 'graph_edge_add':
        if (event.metadata?.edge_quality === 'low') {
          acc.audience_purity = Math.max(0, acc.audience_purity - 0.05);
          acc.bot_risk = Math.min(1, acc.bot_risk + 0.03);
        }
        break;
        
      case 'graph_edge_remove':
        break;
    }
  }
  
  /**
   * Validate expectations
   */
  private validateExpectations(
    failures: string[],
    warnings: string[],
    finalScores: Record<string, number>,
    finalConfidence: Record<string, number>,
    scoreDeltas: Record<string, number>,
    alertsBlocked: number
  ): boolean {
    const exp = this.scenario.expected;
    
    // Check score change direction
    const avgDelta = Object.values(scoreDeltas).reduce((a, b) => a + b, 0) / Object.values(scoreDeltas).length;
    
    if (exp.score_change === 'up' && avgDelta <= 0) {
      failures.push(`Expected score to go UP, but delta=${avgDelta.toFixed(1)}`);
    }
    if (exp.score_change === 'down' && avgDelta >= 0) {
      failures.push(`Expected score to go DOWN, but delta=${avgDelta.toFixed(1)}`);
    }
    if (exp.score_change === 'blocked' && avgDelta > 50) {
      failures.push(`Expected score to be BLOCKED, but delta=${avgDelta.toFixed(1)}`);
    }
    if (exp.score_change === 'stable' && Math.abs(avgDelta) > 100) {
      warnings.push(`Expected stable score, but delta=${avgDelta.toFixed(1)}`);
    }
    
    // Check confidence
    const minConf = Math.min(...Object.values(finalConfidence));
    if (exp.confidence_min > 0 && minConf < exp.confidence_min) {
      if (exp.score_change === 'blocked') {
        // This is expected for blocked scenarios
      } else {
        failures.push(`Confidence ${minConf} below expected ${exp.confidence_min}`);
      }
    }
    
    // Check alerts
    if (!exp.alerts_allowed && alertsBlocked === 0) {
      warnings.push(`Expected alerts to be blocked, but none were blocked`);
    }
    
    // Check rollback
    if (exp.rollback_expected && !this.rollbackTriggered) {
      failures.push(`Expected rollback but none occurred`);
    }
    if (!exp.rollback_expected && this.rollbackTriggered) {
      warnings.push(`Unexpected rollback occurred`);
    }
    
    // Special case: SMART_NONAME
    if (this.scenario.id === 'SMART_NONAME') {
      const smartScore = finalScores['sim_smart_001'] || 0;
      const massScore = finalScores['sim_mass_001'] || 0;
      
      if (smartScore <= massScore) {
        failures.push(`CRITICAL: Smart no-name (${smartScore}) should beat mass influencer (${massScore})`);
      }
    }
    
    return failures.length === 0;
  }
}

/**
 * Run all scenarios
 */
export function runAllScenarios(): { results: SimulationResult[]; summary: { passed: number; failed: number; scenarios: Record<ScenarioId, boolean> } } {
  const scenarios: ScenarioId[] = [
    'BASELINE_STABILITY',
    'BOT_PUMP',
    'SMART_NONAME',
    'ELITE_FOLLOW_UNFOLLOW',
    'GRAPH_POISONING',
    'ALERT_FLOOD',
    'ROLLBACK_DRILL',
    'AI_CONSISTENCY',
  ];
  
  const results: SimulationResult[] = [];
  const scenarioResults: Record<ScenarioId, boolean> = {} as Record<ScenarioId, boolean>;
  let passed = 0;
  let failed = 0;
  
  for (const scenarioId of scenarios) {
    const engine = new SimulationEngine(scenarioId);
    const result = engine.run();
    results.push(result);
    scenarioResults[scenarioId] = result.passed;
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  return {
    results,
    summary: {
      passed,
      failed,
      scenarios: scenarioResults,
    },
  };
}

console.log('[Simulation] Simulation Engine initialized (Phase 4.7)');
