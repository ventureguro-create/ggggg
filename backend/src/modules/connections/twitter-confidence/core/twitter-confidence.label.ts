/**
 * Twitter Confidence Score Label Determination
 * 
 * PHASE 4.1.6 — Twitter Confidence Score v1.0
 */

import type { TwitterConfidenceLabel } from '../contracts/index.js';
import { getConfidenceConfig } from './twitter-confidence.config.js';

/**
 * Determine label from score
 */
export function getConfidenceLabel(score: number): TwitterConfidenceLabel {
  const { labels } = getConfidenceConfig();
  
  if (score >= labels.high) return 'HIGH';
  if (score >= labels.medium) return 'MEDIUM';
  if (score >= labels.low) return 'LOW';
  return 'CRITICAL';
}

/**
 * Label display info
 */
export const CONFIDENCE_LABEL_INFO: Record<TwitterConfidenceLabel, {
  color: string;
  emoji: string;
  description: string;
}> = {
  HIGH: {
    color: '#22c55e',
    emoji: '✅',
    description: 'Data is reliable — full trust',
  },
  MEDIUM: {
    color: '#f59e0b',
    emoji: '⚠️',
    description: 'Use with caution — some dampening applied',
  },
  LOW: {
    color: '#ef4444',
    emoji: '🟡',
    description: 'Strong dampening — data quality concerns',
  },
  CRITICAL: {
    color: '#dc2626',
    emoji: '🛑',
    description: 'Data nearly ignored — quality too low',
  },
};

/**
 * Check if label should trigger dampening
 */
export function shouldDampen(label: TwitterConfidenceLabel): boolean {
  const config = getConfidenceConfig();
  const applyFrom = config.dampening.apply_from_label;
  
  const order: TwitterConfidenceLabel[] = ['HIGH', 'MEDIUM', 'LOW', 'CRITICAL'];
  const applyFromIndex = order.indexOf(applyFrom);
  const currentIndex = order.indexOf(label);
  
  return currentIndex >= applyFromIndex;
}
