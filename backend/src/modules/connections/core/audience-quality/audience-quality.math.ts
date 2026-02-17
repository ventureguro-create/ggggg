/**
 * Audience Quality Math Utils
 * 
 * Proxy calculations for audience quality assessment.
 */

import { audienceQualityConfig as cfg } from "./audience-quality.config.js";

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
export function norm01(value: number, max: number): number {
  return clamp01(safeNum(value, 0) / max);
}

/**
 * Compute overlap pressure (0..1)
 * High jaccard/shared -> high pressure (bad)
 */
export function computeOverlapPressure01(overlap?: {
  avg_jaccard?: number;
  max_jaccard?: number;
  avg_shared?: number;
  max_shared?: number;
}): number {
  if (!overlap) return 0.25; // mild unknown pressure

  const avgJ = clamp01(safeNum(overlap.avg_jaccard, 0));
  const maxJ = clamp01(safeNum(overlap.max_jaccard, avgJ));

  const avgS = safeNum(overlap.avg_shared, 0);
  const maxS = safeNum(overlap.max_shared, avgS);

  // Map jaccard to pressure
  const jSoft = cfg.overlap.jaccard_soft;
  const jHard = cfg.overlap.jaccard_hard;
  const jComponent = clamp01((maxJ - jSoft) / Math.max(1e-6, jHard - jSoft));

  // Map shared to pressure
  const sSoft = cfg.overlap.shared_soft;
  const sHard = cfg.overlap.shared_hard;
  const sComponent = clamp01((maxS - sSoft) / Math.max(1e-6, sHard - sSoft));

  // Mix: max values more important than averages
  const mixed = 
    0.65 * Math.max(jComponent, sComponent) + 
    0.35 * Math.max(avgJ, clamp01(avgS / cfg.normalize.shared_cap));

  return clamp01(mixed);
}

/**
 * Compute bot risk from red flags (0..1)
 */
export function computeBotRisk01(redFlags: string[] = []): number {
  let risk = 0;
  for (const flag of redFlags) {
    const penalty = cfg.botRisk.red_flags[flag as keyof typeof cfg.botRisk.red_flags];
    if (penalty) risk += penalty;
  }
  risk = Math.min(cfg.botRisk.max_from_flags, risk);
  return clamp01(risk);
}

/**
 * Compute purity score (0..1)
 * Purity is inverse of overlap & bot risk (high = good)
 */
export function computePurity01(overlapPressure01: number, botRisk01: number): number {
  const bad = clamp01(0.60 * overlapPressure01 + 0.40 * botRisk01);
  return clamp01(1 - bad);
}

/**
 * Compute smart followers proxy (0..1)
 * Real calculation will use tier1/authority data from Twitter.
 * For now: proxy via signal quality and purity.
 */
export function computeSmartFollowersProxy01(
  xScore01: number, 
  signalNoise01: number, 
  purity01: number
): number {
  const signalQuality = clamp01(0.65 * xScore01 + 0.35 * signalNoise01);
  return clamp01(0.55 * signalQuality + 0.45 * purity01);
}

/**
 * Compute signal quality component (0..1)
 */
export function computeSignalQuality01(xScore01: number, signalNoise01: number): number {
  return clamp01(0.70 * xScore01 + 0.30 * signalNoise01);
}
