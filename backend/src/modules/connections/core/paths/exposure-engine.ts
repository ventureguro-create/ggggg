/**
 * Network Exposure Engine
 * 
 * Computes network exposure metrics:
 * - Average hops to elite/high nodes
 * - Reachable strong nodes count
 * - Overall exposure score and tier
 */

import { pathsConfig as cfg } from './paths-config.js';
import { NetworkExposure, NetworkPath, AuthorityTier } from './paths-types.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Compute network exposure from paths
 */
export function computeExposure(account_id: string, paths: NetworkPath[]): NetworkExposure {
  // Filter paths by target tier
  const elite = paths.filter(p => {
    const lastNode = p.nodes[p.nodes.length - 1];
    return lastNode?.authority_tier === 'elite';
  });
  
  const high = paths.filter(p => {
    const lastNode = p.nodes[p.nodes.length - 1];
    return lastNode?.authority_tier === 'high';
  });
  
  // Calculate averages
  const avg = (arr: number[]): number | null => 
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  
  const avgElite = avg(elite.map(p => p.hops));
  const avgHigh = avg(high.map(p => p.hops));
  
  // Count unique reachable nodes
  const reachableElite = new Set(elite.map(p => p.to)).size;
  const reachableHigh = new Set(high.map(p => p.to)).size;
  
  // Calculate ratios (normalized against expected pool sizes)
  const eliteRatio = clamp01(reachableElite / Math.max(1, 10));
  const highRatio = clamp01(reachableHigh / Math.max(1, 15));
  
  // Inverse hops (closer = higher score)
  const invHops = clamp01(1 / Math.max(1, avgElite ?? 3));
  
  // Calculate exposure score
  const score = 
    cfg.exposure.w_reachable_elite * eliteRatio +
    cfg.exposure.w_reachable_high * highRatio +
    cfg.exposure.w_inverse_avg_hops * invHops;
  
  // Determine tier
  let tier: NetworkExposure['exposure_tier'] = 'weak';
  if (score >= cfg.exposure_tiers.elite) tier = 'elite';
  else if (score >= cfg.exposure_tiers.strong) tier = 'strong';
  else if (score >= cfg.exposure_tiers.moderate) tier = 'moderate';
  
  return {
    account_id,
    avg_hops_to_elite: avgElite,
    avg_hops_to_high: avgHigh,
    reachable_elite: reachableElite,
    reachable_high: reachableHigh,
    exposure_score_0_1: Number(score.toFixed(6)),
    exposure_tier: tier,
  };
}

/**
 * Get exposure tier label for display
 */
export function getExposureTierLabel(tier: NetworkExposure['exposure_tier']): string {
  const labels: Record<NetworkExposure['exposure_tier'], string> = {
    elite: 'Elite Exposure',
    strong: 'Strong Exposure',
    moderate: 'Moderate Exposure',
    weak: 'Weak Exposure',
  };
  return labels[tier] || tier;
}

/**
 * Get exposure tier color
 */
export function getExposureTierColor(tier: NetworkExposure['exposure_tier']): string {
  const colors: Record<NetworkExposure['exposure_tier'], string> = {
    elite: '#8b5cf6',
    strong: '#22c55e',
    moderate: '#f59e0b',
    weak: '#ef4444',
  };
  return colors[tier] || '#6b7280';
}
