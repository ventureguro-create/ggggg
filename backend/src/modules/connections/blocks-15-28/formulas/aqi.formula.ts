/**
 * BLOCK 16 - AQI (Audience Quality Index) Formula
 * 
 * Gives a single number for audience quality (0-100)
 */

export type AQILevel = 'ELITE' | 'GOOD' | 'MIXED' | 'RISKY';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function computeAqi(params: {
  pctHuman: number;
  pctSuspicious: number;
  pctBot: number;
  pctActive: number;
  pctDead: number;
  sharedFarmPenalty: number;
}): { aqi: number; level: AQILevel } {
  const human = params.pctHuman;
  const susp = params.pctSuspicious;
  const bot = params.pctBot;

  // Activity adjustment: if all "dead" - quality down
  const activityAdj = (params.pctActive * 0.6) + ((100 - params.pctDead) * 0.4);
  const activityMultiplier = clamp01(activityAdj / 100);

  // Base quality by composition
  let base = human * 1.0 - susp * 0.45 - bot * 1.2;
  base = Math.max(0, Math.min(100, base));

  // Final
  let aqi = base * (0.75 + 0.25 * activityMultiplier);

  // Penalty for shared farms (BLOCK 15)
  aqi = aqi - params.sharedFarmPenalty;
  aqi = Math.max(0, Math.min(100, aqi));

  const level: AQILevel =
    aqi >= 75 ? 'ELITE' :
    aqi >= 55 ? 'GOOD' :
    aqi >= 35 ? 'MIXED' : 'RISKY';

  return { aqi: round2(aqi), level };
}
