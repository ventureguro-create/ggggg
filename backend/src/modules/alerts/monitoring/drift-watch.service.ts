/**
 * Drift Watch Service - T2.4
 * 
 * Monitors drift and triggers auto-rollback.
 * Main safety mechanism for expansion.
 */

import { Db } from 'mongodb';
import { getExpansionConfig, rollbackToBaseline, shouldAutoRollback } from '../../connections/network/network-expansion.config.js';

export type DriftLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DriftStatus {
  level: DriftLevel;
  score: number;           // 0-1
  trend: 'STABLE' | 'INCREASING' | 'DECREASING';
  last_check: Date;
  auto_rollback_triggered: boolean;
  warnings: string[];
}

let lastDriftStatus: DriftStatus = {
  level: 'LOW',
  score: 0.2,
  trend: 'STABLE',
  last_check: new Date(),
  auto_rollback_triggered: false,
  warnings: [],
};

/**
 * Calculate current drift level
 */
export async function calculateDrift(db: Db): Promise<DriftStatus> {
  const warnings: string[] = [];
  
  try {
    // Get recent alert decisions
    const auditCollection = db.collection('connections_alert_audit');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h
    const decisions = await auditCollection.find({ created_at: { $gte: since } }).toArray();
    
    // Calculate FP rate (approximation: suppress rate change)
    const total = decisions.length;
    const suppressed = decisions.filter(d => d.decision === 'SUPPRESS').length;
    const suppressRate = total > 0 ? suppressed / total : 0;
    
    // Calculate divergence (approximation)
    const divergence = Math.abs(suppressRate - 0.4); // Baseline suppress rate ~40%
    
    // Check for anomalies
    if (suppressRate > 0.7) {
      warnings.push('High suppress rate indicates potential drift');
    }
    
    // Calculate drift score
    let driftScore = divergence * 2;
    
    // Check network data freshness
    const twitterCollection = db.collection('twitter_results');
    const latestTweet = await twitterCollection.findOne({}, { sort: { createdAt: -1 } });
    if (latestTweet) {
      const hoursSince = (Date.now() - new Date(latestTweet.createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 48) {
        driftScore += 0.2;
        warnings.push('Data is stale (>48h)');
      }
    }
    
    driftScore = Math.min(1, Math.max(0, driftScore));
    
    // Determine level
    let level: DriftLevel;
    if (driftScore < 0.3) level = 'LOW';
    else if (driftScore < 0.6) level = 'MEDIUM';
    else level = 'HIGH';
    
    // Check trend
    const trend = driftScore > lastDriftStatus.score + 0.1 
      ? 'INCREASING' 
      : driftScore < lastDriftStatus.score - 0.1 
        ? 'DECREASING' 
        : 'STABLE';
    
    // Check auto-rollback
    const config = getExpansionConfig();
    const rollbackCheck = shouldAutoRollback({
      driftLevel: level,
      fpRate: suppressRate,
      divergence,
    });
    
    if (rollbackCheck.rollback && config.auto_rollback_enabled) {
      rollbackToBaseline();
      warnings.push(`Auto-rollback triggered: ${rollbackCheck.reason}`);
    }
    
    lastDriftStatus = {
      level,
      score: driftScore,
      trend,
      last_check: new Date(),
      auto_rollback_triggered: rollbackCheck.rollback,
      warnings,
    };
    
    console.log(`[DriftWatch] Level: ${level}, Score: ${driftScore.toFixed(2)}, Trend: ${trend}`);
  } catch (err: any) {
    console.error('[DriftWatch] Error:', err.message);
    warnings.push(`Calculation error: ${err.message}`);
  }
  
  return lastDriftStatus;
}

/**
 * Get current drift status
 */
export function getDriftStatus(): DriftStatus {
  return { ...lastDriftStatus };
}

/**
 * Force drift check and potential rollback
 */
export async function checkAndRollback(db: Db): Promise<{
  rolled_back: boolean;
  reason?: string;
  status: DriftStatus;
}> {
  const status = await calculateDrift(db);
  
  return {
    rolled_back: status.auto_rollback_triggered,
    reason: status.auto_rollback_triggered ? status.warnings.find(w => w.includes('rollback')) : undefined,
    status,
  };
}
