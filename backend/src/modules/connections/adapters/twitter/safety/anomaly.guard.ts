/**
 * Anomaly Guard
 * 
 * Detects suspicious data patterns that might indicate:
 * - Bot activity
 * - Manipulation
 * - Data collection errors
 * 
 * PHASE 4.1 — Twitter → Connections Adapter Safety
 */

import type { TwitterAuthorSnapshot, TwitterEngagementEvent } from '../contracts/index.js';
import type { TwitterAdapterConfig } from '../adapter/twitter-adapter.config.js';

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  is_anomaly: boolean;
  type?: 'followers_spike' | 'engagement_spike' | 'rate_exceeded' | 'suspicious_ratio';
  severity: 'low' | 'medium' | 'high';
  message?: string;
  value?: number;
  threshold?: number;
}

/**
 * Followers history for spike detection
 */
const followersHistory = new Map<string, { count: number; timestamp: number }[]>();

/**
 * Check for followers spike
 * 
 * Rule: If followers increase by > X% in Y hours, flag as anomaly
 */
export function checkFollowersSpike(
  snapshot: TwitterAuthorSnapshot,
  config: TwitterAdapterConfig
): AnomalyResult {
  const authorId = snapshot.author_id;
  const now = Date.now();
  const lookbackMs = (config.safety.spike_lookback_hours || 6) * 60 * 60 * 1000;
  const maxSpikePct = config.safety.max_followers_spike_pct || 30;
  
  // Get historical data
  const history = followersHistory.get(authorId) || [];
  
  // Clean old entries
  const recentHistory = history.filter(h => now - h.timestamp < lookbackMs);
  
  // Add current
  recentHistory.push({ count: snapshot.followers, timestamp: now });
  followersHistory.set(authorId, recentHistory.slice(-10)); // Keep last 10
  
  // Check spike
  if (recentHistory.length >= 2) {
    const oldest = recentHistory[0];
    const newest = recentHistory[recentHistory.length - 1];
    
    if (oldest.count > 0) {
      const changePct = ((newest.count - oldest.count) / oldest.count) * 100;
      
      if (changePct > maxSpikePct) {
        return {
          is_anomaly: true,
          type: 'followers_spike',
          severity: changePct > maxSpikePct * 2 ? 'high' : 'medium',
          message: `Followers increased ${changePct.toFixed(1)}% in ${config.safety.spike_lookback_hours}h`,
          value: changePct,
          threshold: maxSpikePct,
        };
      }
    }
  }
  
  return { is_anomaly: false, severity: 'low' };
}

/**
 * Check for suspicious follower/following ratio
 */
export function checkSuspiciousRatio(
  snapshot: TwitterAuthorSnapshot
): AnomalyResult {
  const { followers, following } = snapshot;
  
  // Very low following but high followers (might be celebrity or bot)
  if (following > 0 && followers / following > 1000) {
    return {
      is_anomaly: true,
      type: 'suspicious_ratio',
      severity: 'low',
      message: `Unusual ratio: ${followers} followers / ${following} following`,
      value: followers / following,
      threshold: 1000,
    };
  }
  
  // Following much more than followers (might be spam account)
  if (following > 5000 && following > followers * 10) {
    return {
      is_anomaly: true,
      type: 'suspicious_ratio',
      severity: 'medium',
      message: `Spam pattern: following ${following} >> followers ${followers}`,
      value: following / (followers || 1),
      threshold: 10,
    };
  }
  
  return { is_anomaly: false, severity: 'low' };
}

/**
 * Check engagement spike (unusually high engagement)
 */
export function checkEngagementSpike(
  event: TwitterEngagementEvent,
  avgEngagement: number
): AnomalyResult {
  if (avgEngagement <= 0) {
    return { is_anomaly: false, severity: 'low' };
  }
  
  const totalEngagement = event.likes + event.reposts + event.replies;
  const ratio = totalEngagement / avgEngagement;
  
  // Engagement > 10x average is suspicious
  if (ratio > 10) {
    return {
      is_anomaly: true,
      type: 'engagement_spike',
      severity: ratio > 50 ? 'high' : 'medium',
      message: `Engagement ${ratio.toFixed(1)}x average`,
      value: ratio,
      threshold: 10,
    };
  }
  
  return { is_anomaly: false, severity: 'low' };
}

/**
 * Rate counter for events per hour
 */
const eventRateCounter = new Map<string, number[]>();

/**
 * Check rate limit (events per hour)
 */
export function checkRateLimit(
  authorId: string,
  config: TwitterAdapterConfig
): AnomalyResult {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const maxRate = config.safety.max_events_per_hour || 1000;
  
  // Get timestamps
  const timestamps = eventRateCounter.get(authorId) || [];
  
  // Clean old entries
  const recent = timestamps.filter(t => now - t < hourMs);
  recent.push(now);
  eventRateCounter.set(authorId, recent.slice(-maxRate * 2));
  
  if (recent.length > maxRate) {
    return {
      is_anomaly: true,
      type: 'rate_exceeded',
      severity: 'high',
      message: `Rate limit exceeded: ${recent.length} events/hour`,
      value: recent.length,
      threshold: maxRate,
    };
  }
  
  return { is_anomaly: false, severity: 'low' };
}

/**
 * Clear anomaly tracking (for testing)
 */
export function clearAnomalyTracking(): void {
  followersHistory.clear();
  eventRateCounter.clear();
}

/**
 * Get anomaly stats
 */
export function getAnomalyStats() {
  return {
    tracked_authors: followersHistory.size,
    rate_tracked: eventRateCounter.size,
  };
}
