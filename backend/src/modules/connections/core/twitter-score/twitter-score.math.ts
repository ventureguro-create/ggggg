/**
 * Twitter Score Math Utils
 * 
 * Normalization, clamping, and formula helpers.
 */

import { twitterScoreConfig as cfg } from "./twitter-score.config.js";

/**
 * Clamp value to [0, 1]
 */
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Safe number conversion with fallback
 */
export function safeNum(x: any, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize value from [0, max] to [0, 1]
 */
export function normRange(value: number, max: number): number {
  return clamp01(safeNum(value, 0) / max);
}

/**
 * Normalize signed value from [-cap, cap] to [0, 1]
 * 0.5 = neutral (zero), >0.5 = positive, <0.5 = negative
 */
export function normSigned(value: number, cap: number): number {
  const v = Math.max(-cap, Math.min(cap, safeNum(value, 0)));
  return clamp01((v + cap) / (2 * cap));
}

/**
 * Compute trend score [0, 1]
 * 0.5 = neutral, >0.5 = growing, <0.5 = declining
 */
export function computeTrend01(velocity: number, acceleration: number): number {
  const v01 = normSigned(velocity, cfg.normalize.velocity_cap);
  const a01 = normSigned(acceleration, cfg.normalize.acceleration_cap);

  // Mix with configured weights
  const t = cfg.trend.k_velocity * v01 + cfg.trend.k_acceleration * a01;
  return clamp01(t);
}

/**
 * Compute total penalty from risk level and red flags
 * Returns { total_penalty, risk_penalty, red_flags_penalty }
 */
export function computePenalties01(
  riskLevel: "LOW" | "MED" | "HIGH", 
  redFlags: string[]
): { total_penalty: number; risk_penalty: number; red_flags_penalty: number } {
  const riskPenalty = cfg.penalties.risk_level[riskLevel] ?? 0;

  let redFlagsPenalty = 0;
  for (const flag of redFlags) {
    const penalty = cfg.penalties.red_flags[flag as keyof typeof cfg.penalties.red_flags];
    if (penalty) redFlagsPenalty += penalty;
  }

  const total = Math.min(cfg.penalties.max_total_penalty, riskPenalty + redFlagsPenalty);
  
  return { 
    total_penalty: total, 
    risk_penalty: riskPenalty, 
    red_flags_penalty: redFlagsPenalty 
  };
}

/**
 * Weighted average of components
 */
export function weightedAverage(values: Record<string, number>, weights: Record<string, number>): number {
  let sum = 0;
  let weightSum = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    if (values[key] !== undefined) {
      sum += values[key] * weight;
      weightSum += weight;
    }
  }
  
  return weightSum > 0 ? sum / weightSum : 0;
}
