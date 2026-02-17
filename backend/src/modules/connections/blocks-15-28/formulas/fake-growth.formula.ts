/**
 * BLOCK 17 - Fake Growth Detector Formula
 * 
 * Detects manipulation through growth patterns:
 * - Spike Growth
 * - Churn Farming
 * - Follow Rings
 * - Dead Engagement Growth
 */

export type GrowthLabel = 'CLEAN' | 'SUSPICIOUS' | 'MANIPULATED';

export function computeGrowthScore(params: {
  spikeRatio: number;
  churnRate: number;
  deadGrowthRate: number;
  followRingScore: number;
}): { score: number; label: GrowthLabel } {
  let score = 100;

  // Spike penalty
  if (params.spikeRatio > 6) score -= 35;
  else if (params.spikeRatio > 3) score -= 20;

  // Churn penalty
  if (params.churnRate > 0.4) score -= 30;
  else if (params.churnRate > 0.2) score -= 15;

  // Dead growth penalty
  if (params.deadGrowthRate > 0.5) score -= 25;
  else if (params.deadGrowthRate > 0.3) score -= 12;

  // Follow ring penalty
  if (params.followRingScore > 0.35) score -= 20;

  score = Math.max(0, Math.min(100, score));

  const label: GrowthLabel =
    score >= 70 ? 'CLEAN' :
    score >= 40 ? 'SUSPICIOUS' :
    'MANIPULATED';

  return { score, label };
}

export function buildGrowthReasons(
  score: number,
  spikeRatio: number,
  churnRate: number,
  deadGrowthRate: number
): string[] {
  const reasons: string[] = [];
  
  if (spikeRatio > 6) reasons.push(`Extreme spike detected (${spikeRatio.toFixed(1)}x avg)`);
  else if (spikeRatio > 3) reasons.push(`Suspicious spike (${spikeRatio.toFixed(1)}x avg)`);
  
  if (churnRate > 0.4) reasons.push(`High churn rate (${(churnRate * 100).toFixed(0)}%)`);
  else if (churnRate > 0.2) reasons.push(`Elevated churn (${(churnRate * 100).toFixed(0)}%)`);
  
  if (deadGrowthRate > 0.5) reasons.push(`Growth without engagement (${(deadGrowthRate * 100).toFixed(0)}%)`);
  
  if (score >= 70) reasons.push('Growth pattern appears organic');
  
  return reasons;
}
