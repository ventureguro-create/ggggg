/**
 * Twitter Confidence Score Explain
 * 
 * Human-readable explanations for confidence scores.
 * 
 * PHASE 4.1.6 — Twitter Confidence Score v1.0
 */

import type { TwitterConfidenceResult } from '../contracts/index.js';
import { CONFIDENCE_LABEL_INFO } from './twitter-confidence.label.js';

/**
 * Generate explanation for confidence score
 */
export function explainConfidence(result: TwitterConfidenceResult): {
  summary: string;
  details: string[];
  recommendation: string;
} {
  const { label, score_0_1, components, warnings } = result;
  const labelInfo = CONFIDENCE_LABEL_INFO[label];
  
  // Summary
  const summary = `${labelInfo.emoji} ${label} confidence (${(score_0_1 * 100).toFixed(0)}%): ${labelInfo.description}`;
  
  // Details
  const details: string[] = [];
  
  // Analyze each component
  if (components.freshness < 0.5) {
    details.push(`⏱️ Freshness: ${(components.freshness * 100).toFixed(0)}% — data is getting stale`);
  } else if (components.freshness >= 0.9) {
    details.push(`✅ Freshness: ${(components.freshness * 100).toFixed(0)}% — data is very recent`);
  }
  
  if (components.coverage < 0.6) {
    details.push(`📊 Coverage: ${(components.coverage * 100).toFixed(0)}% — missing data sources`);
  } else if (components.coverage >= 1.0) {
    details.push(`✅ Coverage: 100% — all data sources available`);
  }
  
  if (components.consistency < 0.7) {
    details.push(`📉 Consistency: ${(components.consistency * 100).toFixed(0)}% — gaps or volatility in data`);
  }
  
  if (components.anomaly_health < 0.7) {
    details.push(`⚠️ Anomaly Health: ${(components.anomaly_health * 100).toFixed(0)}% — anomalies detected`);
  }
  
  if (components.source_trust < 0.8) {
    details.push(`🔐 Source Trust: ${(components.source_trust * 100).toFixed(0)}% — non-standard data source`);
  }
  
  // Recommendation
  let recommendation: string;
  switch (label) {
    case 'HIGH':
      recommendation = 'Data quality is excellent. Full trust in computations.';
      break;
    case 'MEDIUM':
      recommendation = 'Data quality is acceptable. Minor dampening applied to reduce noise.';
      break;
    case 'LOW':
      recommendation = 'Data quality concerns. Strong dampening applied. Consider refreshing data sources.';
      break;
    case 'CRITICAL':
      recommendation = 'Data quality is too low. Most computations are dampened. Alerts blocked.';
      break;
  }
  
  return { summary, details, recommendation };
}

/**
 * Format confidence for display in alerts/messages
 */
export function formatConfidenceForAlert(result: TwitterConfidenceResult): string {
  const labelInfo = CONFIDENCE_LABEL_INFO[result.label];
  return `${labelInfo.emoji} Confidence: ${result.label} (${(result.score_0_1 * 100).toFixed(0)}%)`;
}

/**
 * Get confidence impact description
 */
export function getConfidenceImpact(result: TwitterConfidenceResult): string {
  switch (result.label) {
    case 'HIGH':
      return 'Data fully trusted';
    case 'MEDIUM':
      return 'Data dampened by ~' + Math.round((1 - result.score_0_1) * 50) + '%';
    case 'LOW':
      return 'Data dampened by ~' + Math.round((1 - result.score_0_1) * 60) + '%';
    case 'CRITICAL':
      return 'Data nearly ignored';
  }
}
