/**
 * ScrollEngine - управление безопасным парсингом
 * 
 * Решает КАК безопасно выполнить задачу:
 * - Выбирает задержки
 * - Оценивает риск
 * - Downgrade при HIGH
 * - Abort при CRITICAL
 */

import {
  ScrollProfile,
  ScrollEngineConfig,
  ScrollEngineState,
  ScrollTelemetry,
  RuntimeRisk,
  RiskLevel,
} from './scroll.types.js';
import { SCROLL_POLICIES, randomInRange, downgradeProfile, getCooldownPause } from './scroll.policies.js';
import { RiskAssessor } from './risk.assessor.js';

export interface ScrollHints {
  /** Delay before next scroll (ms) */
  delayMs: number;
  
  /** Scroll distance (px) */
  scrollPx: number;
  
  /** Should stop */
  shouldStop: boolean;
  
  /** Needs cooldown pause */
  needsCooldown: boolean;
  
  /** Cooldown duration (ms) */
  cooldownMs: number;
  
  /** Stop reason */
  reason?: string;
}

export class ScrollEngine {
  private config: ScrollEngineConfig;
  private state: ScrollEngineState;
  private riskAssessor: RiskAssessor;
  private startTime: number;

  constructor(config: ScrollEngineConfig) {
    this.config = config;
    this.riskAssessor = new RiskAssessor();
    this.startTime = Date.now();
    
    this.state = {
      profile: config.initialProfile,
      fetchedPosts: 0,
      scrolls: 0,
      startedAt: new Date(),
      lastRisk: null,
      aborted: false,
      downgrades: 0,
      emptyResponsesStreak: 0,
      sameDelayCount: 0,
      lastDelay: 0,
    };

    console.log(`[ScrollEngine] Started with profile ${config.initialProfile}, target ${config.plannedPosts} posts`);
  }

  /**
   * Get current policy based on profile
   */
  getPolicy() {
    return SCROLL_POLICIES[this.state.profile];
  }

  /**
   * Get hints for next scroll iteration
   */
  getNextHints(): ScrollHints {
    const policy = this.getPolicy();
    
    // Calculate delay with micro jitter
    let delayMs = randomInRange(policy.minDelayMs, policy.maxDelayMs);
    
    // Add micro jitter occasionally (30% chance)
    if (Math.random() < 0.3) {
      delayMs += randomInRange(0, policy.microJitterMax);
    }
    
    // Track same delay pattern
    if (Math.abs(delayMs - this.state.lastDelay) < 200) {
      this.state.sameDelayCount++;
    } else {
      this.state.sameDelayCount = 0;
    }
    this.state.lastDelay = delayMs;
    
    // Calculate scroll distance
    const scrollPx = randomInRange(policy.scrollPxMin, policy.scrollPxMax);
    
    return {
      delayMs,
      scrollPx,
      shouldStop: false,
      needsCooldown: false,
      cooldownMs: 0,
    };
  }

  /**
   * Process telemetry from scroll iteration
   * Returns hints for what to do next
   */
  processTelemetry(telemetry: ScrollTelemetry): ScrollHints {
    this.state.scrolls++;
    this.state.fetchedPosts += telemetry.fetchedThisBatch;
    
    // Track empty responses
    if (telemetry.emptyResponse) {
      this.state.emptyResponsesStreak++;
    } else {
      this.state.emptyResponsesStreak = 0;
    }
    
    // Calculate scrolls per minute
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const scrollsPerMinute = elapsedMinutes > 0 ? this.state.scrolls / elapsedMinutes : 0;
    
    // Assess risk
    const risk = this.riskAssessor.assess(telemetry, {
      emptyStreak: this.state.emptyResponsesStreak,
      sameDelayCount: this.state.sameDelayCount,
      scrollsPerMinute,
    });
    this.state.lastRisk = risk;
    
    // Log risk if elevated
    if (risk.level !== RiskLevel.LOW) {
      console.log(`[ScrollEngine] Risk ${risk.level} (${risk.score}): ${risk.factors.join(', ')}`);
    }
    
    // Check CRITICAL - abort
    if (risk.level === RiskLevel.CRITICAL) {
      this.state.aborted = true;
      return {
        delayMs: 0,
        scrollPx: 0,
        shouldStop: true,
        needsCooldown: false,
        cooldownMs: 0,
        reason: `CRITICAL risk (${risk.score}): ${risk.factors.join(', ')}`,
      };
    }
    
    // Check HIGH - downgrade + cooldown
    if (risk.level === RiskLevel.HIGH) {
      const nextProfile = downgradeProfile(this.state.profile);
      
      if (nextProfile) {
        this.state.profile = nextProfile;
        this.state.downgrades++;
        console.log(`[ScrollEngine] Downgraded to ${nextProfile}`);
        
        const cooldownMs = getCooldownPause();
        return {
          ...this.getNextHints(),
          needsCooldown: true,
          cooldownMs,
        };
      } else {
        // Already at SAFE, abort
        this.state.aborted = true;
        return {
          delayMs: 0,
          scrollPx: 0,
          shouldStop: true,
          needsCooldown: false,
          cooldownMs: 0,
          reason: 'Cannot downgrade further (already SAFE)',
        };
      }
    }
    
    // Check completion
    if (this.state.fetchedPosts >= this.config.plannedPosts) {
      return {
        delayMs: 0,
        scrollPx: 0,
        shouldStop: true,
        needsCooldown: false,
        cooldownMs: 0,
        reason: 'Target reached',
      };
    }
    
    // Check too many empty responses
    if (this.state.emptyResponsesStreak >= 5) {
      return {
        delayMs: 0,
        scrollPx: 0,
        shouldStop: true,
        needsCooldown: false,
        cooldownMs: 0,
        reason: 'Too many empty responses',
      };
    }
    
    // Continue with next hints
    return this.getNextHints();
  }

  /**
   * Get current state
   */
  getState(): ScrollEngineState {
    return { ...this.state };
  }

  /**
   * Check if should continue
   */
  shouldContinue(): boolean {
    return !this.state.aborted && this.state.fetchedPosts < this.config.plannedPosts;
  }

  /**
   * Get summary for logging
   */
  getSummary(): {
    taskId?: string;
    profile: ScrollProfile;
    profileChanges: number;
    fetchedPosts: number;
    scrolls: number;
    durationMs: number;
    aborted: boolean;
    finalRisk: number;
  } {
    return {
      taskId: this.config.taskId,
      profile: this.state.profile,
      profileChanges: this.state.downgrades,
      fetchedPosts: this.state.fetchedPosts,
      scrolls: this.state.scrolls,
      durationMs: Date.now() - this.startTime,
      aborted: this.state.aborted,
      finalRisk: this.state.lastRisk?.score ?? 0,
    };
  }
}

/**
 * Select initial profile based on account history
 */
export function selectInitialProfile(memory?: {
  lastAbortAt?: Date;
  avgLatency?: number;
  successRate?: number;
}): ScrollProfile {
  if (!memory) return ScrollProfile.SAFE;

  // If recently aborted, stay safe
  if (memory.lastAbortAt) {
    const hoursSinceAbort = (Date.now() - memory.lastAbortAt.getTime()) / 3600000;
    if (hoursSinceAbort < 6) return ScrollProfile.SAFE;
  }

  // If good metrics, can try normal
  if (memory.successRate && memory.successRate > 0.9 && memory.avgLatency && memory.avgLatency < 2000) {
    return ScrollProfile.NORMAL;
  }

  return ScrollProfile.SAFE;
}
