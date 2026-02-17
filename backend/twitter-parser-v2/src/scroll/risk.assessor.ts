/**
 * Risk Assessor - оценка риска в реальном времени
 * 
 * Score 0-100:
 * - LOW: 0-24
 * - MEDIUM: 25-49
 * - HIGH: 50-74
 * - CRITICAL: 75+
 */

import { ScrollTelemetry, RuntimeRisk, RiskLevel } from './scroll.types.js';

/** Risk weights for signals */
const WEIGHTS = {
  xhrError: 20,           // per error in window
  latencyHigh: 10,        // latency > 2500ms
  latencyVeryHigh: 20,    // latency > 4500ms
  captcha: 60,            // captcha detected
  rateLimit: 60,          // rate limit hit
  emptyStreak2: 15,       // 2+ empty responses in a row
  emptyStreak3: 25,       // 3+ empty responses
  sameInterval5: 10,      // same delay 5 times
  tooFastScrolls: 15,     // > 40 scrolls/min
};

/** Risk decay per successful iteration */
const DECAY_PER_SUCCESS = 5;

export class RiskAssessor {
  private currentScore = 0;
  private telemetryWindow: ScrollTelemetry[] = [];
  private readonly windowSize = 10;
  
  /**
   * Assess risk based on new telemetry
   */
  assess(telemetry: ScrollTelemetry, state: { emptyStreak: number; sameDelayCount: number; scrollsPerMinute: number }): RuntimeRisk {
    // Add to window
    this.telemetryWindow.push(telemetry);
    if (this.telemetryWindow.length > this.windowSize) {
      this.telemetryWindow.shift();
    }

    let addedRisk = 0;
    const factors: string[] = [];

    // Factor 1: XHR Errors
    if (telemetry.xhrErrors > 0) {
      addedRisk += WEIGHTS.xhrError * telemetry.xhrErrors;
      factors.push(`XHR errors: ${telemetry.xhrErrors}`);
    }

    // Factor 2: Latency
    if (telemetry.latencyMs > 4500) {
      addedRisk += WEIGHTS.latencyVeryHigh;
      factors.push(`Very high latency: ${telemetry.latencyMs}ms`);
    } else if (telemetry.latencyMs > 2500) {
      addedRisk += WEIGHTS.latencyHigh;
      factors.push(`High latency: ${telemetry.latencyMs}ms`);
    }

    // Factor 3: Captcha
    if (telemetry.captchaSeen) {
      addedRisk += WEIGHTS.captcha;
      factors.push('Captcha detected');
    }

    // Factor 4: Rate limit
    if (telemetry.rateLimitSeen) {
      addedRisk += WEIGHTS.rateLimit;
      factors.push('Rate limit hit');
    }

    // Factor 5: Empty responses streak
    if (state.emptyStreak >= 3) {
      addedRisk += WEIGHTS.emptyStreak3;
      factors.push(`Empty streak: ${state.emptyStreak}`);
    } else if (state.emptyStreak >= 2) {
      addedRisk += WEIGHTS.emptyStreak2;
      factors.push(`Empty streak: ${state.emptyStreak}`);
    }

    // Factor 6: Same interval pattern
    if (state.sameDelayCount >= 5) {
      addedRisk += WEIGHTS.sameInterval5;
      factors.push('Repetitive timing pattern');
    }

    // Factor 7: Too fast scrolling
    if (state.scrollsPerMinute > 40) {
      addedRisk += WEIGHTS.tooFastScrolls;
      factors.push(`Fast scrolling: ${state.scrollsPerMinute}/min`);
    }

    // Apply decay for successful iteration (no critical signals)
    if (addedRisk === 0 && telemetry.fetchedThisBatch > 0) {
      this.currentScore = Math.max(0, this.currentScore - DECAY_PER_SUCCESS);
    } else {
      this.currentScore = Math.min(100, this.currentScore + addedRisk);
    }

    return {
      score: this.currentScore,
      level: this.scoreToLevel(this.currentScore),
      factors,
    };
  }

  /**
   * Convert score to risk level
   */
  private scoreToLevel(score: number): RiskLevel {
    if (score >= 75) return RiskLevel.CRITICAL;
    if (score >= 50) return RiskLevel.HIGH;
    if (score >= 25) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Reset risk (for new task)
   */
  reset(): void {
    this.currentScore = 0;
    this.telemetryWindow = [];
  }

  /**
   * Get current score
   */
  getScore(): number {
    return this.currentScore;
  }
}
