/**
 * Audience Quality Engine (AQE)
 * 
 * Main engine that orchestrates:
 * 1. Follower sampling via reader
 * 2. Classification of each follower
 * 3. Aggregate metrics calculation
 * 4. Anomaly detection
 * 
 * Output:
 * - real_audience_pct: Estimated % of real followers
 * - bot_pressure_pct: Estimated % of bots/farms
 * - confidence: Based on sample size
 */

import type { AQEConfig } from '../contracts/audienceQuality.config.js';
import { DEFAULT_AQE_CONFIG } from '../contracts/audienceQuality.config.js';
import type { AQEResult, AQEConfidenceLevel } from '../contracts/audienceQuality.types.js';
import type { IAudienceFollowerReader } from '../ports/audienceFollower.reader.port.js';
import { classifyFollower } from './audienceQuality.classifier.js';
import { computeAnomaly } from './audienceQuality.anomaly.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export class AudienceQualityEngine {
  constructor(
    private readonly reader: IAudienceFollowerReader,
    private readonly cfg: AQEConfig = DEFAULT_AQE_CONFIG
  ) {}

  async evaluate(actorId: string): Promise<AQEResult | null> {
    if (!this.cfg.enabled) return null;

    // 1. Sample followers
    const sample = await this.reader.sampleFollowers({ 
      actorId, 
      sampleSize: this.cfg.sampleSize 
    });
    
    if (!sample || !sample.followers?.length) return null;

    // 2. Classify each follower
    const classified = sample.followers.map(f =>
      classifyFollower({
        followerId: f.id,
        username: f.username,
        profile: {
          createdAt: f.createdAt,
          tweetsTotal: f.tweetsTotal,
          tweetsLast30d: f.tweetsLast30d,
          followersCount: f.followersCount,
          followingCount: f.followingCount,
          avgLikes: f.avgLikes,
          avgRetweets: f.avgRetweets,
          activityDaysLast30: f.activityDaysLast30,
          hasAvatar: f.hasAvatar,
          hasBio: f.hasBio,
        },
        cfg: this.cfg,
      })
    );

    // 3. Calculate breakdown
    const breakdown = {
      real: classified.filter(x => x.label === 'REAL').length,
      low_quality: classified.filter(x => x.label === 'LOW_QUALITY').length,
      bot_likely: classified.filter(x => x.label === 'BOT_LIKELY').length,
      farm_node: classified.filter(x => x.label === 'FARM_NODE').length,
    };

    // 4. Calculate aggregate metrics
    const total = classified.length;
    
    // real_audience_pct = (REAL + 0.5 * LOW_QUALITY) / TOTAL
    const realPct = (breakdown.real + 0.5 * breakdown.low_quality) / Math.max(1, total);
    
    // bot_pressure_pct = (BOT_LIKELY + FARM_NODE) / TOTAL
    const botPct = (breakdown.bot_likely + breakdown.farm_node) / Math.max(1, total);

    // confidence = min(1, sampled / 1000)
    const confidence = clamp01(total / 1000);
    const confidence_level: AQEConfidenceLevel = 
      confidence >= 0.75 ? 'HIGH' : 
      confidence >= 0.35 ? 'MEDIUM' : 
      'LOW';

    // 5. Detect anomalies
    const anomaly = computeAnomaly({
      followersSeries: sample.followersSeries,
      engagementSeries: sample.engagementSeries,
      cfg: this.cfg,
    });

    // 6. Get top suspicious followers for display
    const topSuspiciousFollowers = classified
      .filter(x => x.label === 'FARM_NODE' || x.label === 'BOT_LIKELY')
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => ({ 
        followerId: x.followerId, 
        username: x.username, 
        label: x.label, 
        reasons: x.reasons 
      }));

    // 7. Build result
    const result: AQEResult = {
      actorId,
      twitterHandle: sample.twitterHandle,
      sampledFollowers: total,
      totalFollowersHint: sample.totalFollowersHint,

      real_audience_pct: Math.round(clamp01(realPct) * 10000) / 10000,
      bot_pressure_pct: Math.round(clamp01(botPct) * 10000) / 10000,
      confidence: Math.round(confidence * 100) / 100,
      confidence_level,

      breakdown,
      anomaly,

      topSuspiciousFollowers,
      createdAt: new Date().toISOString(),
      ttlSeconds: this.cfg.cacheTtlSeconds,
    };

    return result;
  }
}
