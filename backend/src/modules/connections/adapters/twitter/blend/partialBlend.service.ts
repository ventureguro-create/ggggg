/**
 * Partial Blend Service
 * 
 * Blends mock and live Twitter data for scoring.
 * SAFE: Only engagement/trend, confidence-gated.
 */

import { Db } from 'mongodb';
import { readAllTwitterData } from '../adapter/twitter-adapter.service.js';
import { getAdapterConfig } from '../adapter/twitter-adapter.config.js';

export interface BlendConfig {
  enabled: boolean;
  engagement_weight: number;
  trend_weight: number;
  network_weight: number;
  authority_weight: number;
  confidence_gate: number;
}

export interface BlendResult {
  author_id: string;
  username: string;
  mock_score: number;
  live_engagement_score: number;
  live_trend_score: number;
  blended_score: number;
  weights_applied: { mock: number; engagement: number; trend: number };
  confidence: number;
  confidence_met: boolean;
  blend_applied: boolean;
  reason?: string;
}

export interface BlendSummary {
  success: boolean;
  config: BlendConfig;
  results: BlendResult[];
  stats: {
    total_authors: number;
    blended_count: number;
    mock_only_count: number;
    avg_mock_score: number;
    avg_blended_score: number;
    avg_delta: number;
  };
  warnings: string[];
}

const DEFAULT_BLEND_CONFIG: BlendConfig = {
  enabled: true,
  engagement_weight: 0.2,
  trend_weight: 0.1,
  network_weight: 0,
  authority_weight: 0,
  confidence_gate: 0.7,
};

let blendConfig: BlendConfig = { ...DEFAULT_BLEND_CONFIG };

export function getBlendConfig(): BlendConfig {
  return { ...blendConfig };
}

export function updateBlendConfig(updates: Partial<BlendConfig>): BlendConfig {
  blendConfig = {
    ...blendConfig,
    ...updates,
    engagement_weight: Math.min(0.3, Math.max(0, updates.engagement_weight || blendConfig.engagement_weight)),
    trend_weight: Math.min(0.2, Math.max(0, updates.trend_weight || blendConfig.trend_weight)),
    network_weight: 0,
    authority_weight: 0,
  };
  return { ...blendConfig };
}

export async function calculateBlendedScores(db: Db): Promise<BlendSummary> {
  const config = getBlendConfig();
  const adapterConfig = getAdapterConfig();
  
  const summary: BlendSummary = {
    success: false,
    config,
    results: [],
    stats: { total_authors: 0, blended_count: 0, mock_only_count: 0, avg_mock_score: 0, avg_blended_score: 0, avg_delta: 0 },
    warnings: [],
  };

  if (!config.enabled || !adapterConfig.enabled) {
    summary.warnings.push('Blend or adapter disabled');
    summary.success = true;
    return summary;
  }

  try {
    const collection = db.collection('twitter_results');
    const authorStats = await collection.aggregate([
      { $group: { _id: '$author.id', username: { $first: '$author.username' }, tweet_count: { $sum: 1 }, total_engagement: { $sum: { $add: ['$likes', '$reposts', '$replies'] } }, total_views: { $sum: '$views' }, latest_tweet: { $max: '$createdAt' } } },
      { $match: { tweet_count: { $gte: 3 } } }
    ]).toArray();

    for (const author of authorStats) {
      const engagementRate = author.total_views > 0 ? author.total_engagement / author.total_views : 0;
      const liveEngagementScore = Math.min(1, engagementRate * 10);
      const daysSinceLatest = (Date.now() - new Date(author.latest_tweet).getTime()) / (1000 * 60 * 60 * 24);
      const liveTrendScore = Math.max(0, 1 - daysSinceLatest / 14);
      const mockScore = 0.5 + Math.random() * 0.2;
      
      const dataConfidence = Math.min(0.75, (author.tweet_count >= 10 ? 0.3 : author.tweet_count / 10 * 0.3) + (engagementRate > 0.01 ? 0.3 : engagementRate * 30) + (daysSinceLatest < 7 ? 0.15 : 0));
      const confidenceMet = dataConfidence >= config.confidence_gate;
      
      let blendedScore: number;
      let weightsApplied: { mock: number; engagement: number; trend: number };
      
      if (!confidenceMet) {
        blendedScore = mockScore;
        weightsApplied = { mock: 1, engagement: 0, trend: 0 };
      } else {
        const mockWeight = 1 - config.engagement_weight - config.trend_weight;
        blendedScore = mockScore * mockWeight + liveEngagementScore * config.engagement_weight + liveTrendScore * config.trend_weight;
        weightsApplied = { mock: mockWeight, engagement: config.engagement_weight, trend: config.trend_weight };
      }

      summary.results.push({
        author_id: author._id,
        username: author.username,
        mock_score: mockScore,
        live_engagement_score: liveEngagementScore,
        live_trend_score: liveTrendScore,
        blended_score: blendedScore,
        weights_applied: weightsApplied,
        confidence: dataConfidence,
        confidence_met: confidenceMet,
        blend_applied: confidenceMet,
        reason: confidenceMet ? undefined : `Confidence ${(dataConfidence * 100).toFixed(0)}% < gate`,
      });
    }

    summary.stats.total_authors = summary.results.length;
    summary.stats.blended_count = summary.results.filter(r => r.blend_applied).length;
    summary.stats.mock_only_count = summary.results.filter(r => !r.blend_applied).length;
    if (summary.results.length > 0) {
      summary.stats.avg_mock_score = summary.results.reduce((s, r) => s + r.mock_score, 0) / summary.results.length;
      summary.stats.avg_blended_score = summary.results.reduce((s, r) => s + r.blended_score, 0) / summary.results.length;
      summary.stats.avg_delta = summary.stats.avg_blended_score - summary.stats.avg_mock_score;
    }
    summary.success = true;
  } catch (err: any) {
    summary.warnings.push(`Error: ${err.message}`);
  }
  return summary;
}

export async function previewAuthorBlend(db: Db, authorId: string): Promise<BlendResult | null> {
  const summary = await calculateBlendedScores(db);
  return summary.results.find(r => r.author_id === authorId) || null;
}
