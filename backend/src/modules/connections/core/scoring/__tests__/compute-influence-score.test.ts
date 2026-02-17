/**
 * Tests for Influence Score Computation
 * 
 * Tests:
 * - Basic scoring calculation
 * - Decay weighting
 * - Volatility calculation
 * - Red flags detection
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import { computeInfluenceScore } from '../compute-influence-score.js';
import type { NormalizedAuthorMetrics } from '../../normalization/normalize-author-metrics.js';

// Helper to create test data
function createTestMetrics(overrides: Partial<NormalizedAuthorMetrics> = {}): NormalizedAuthorMetrics {
  return {
    author_id: 'test_author_123',
    handle: 'testuser',
    metrics: {
      likes: 100,
      reposts: 20,
      replies: 10,
      views: 5000,
    },
    audience: {
      window_days: 30,
      engaged_user_ids: [],
    },
    timestamp: new Date().toISOString(),
    normalized: {
      engagement_quality: 0.5,
      activity_weight: 5.0,
      total_engagement: 130,
      weighted_engagement: 170,
      engagement_ratio: 0.026,
      has_real_views: true,
    },
    ...overrides,
  };
}

describe('computeInfluenceScore', () => {
  describe('Basic scoring', () => {
    it('should calculate influence score from engagement quality', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.5,
          activity_weight: 5.0,
          total_engagement: 130,
          weighted_engagement: 170,
          engagement_ratio: 0.026,
          has_real_views: true,
        },
      });

      const result = computeInfluenceScore(metrics);

      expect(result.scores.influence_score).toBeGreaterThan(0);
      expect(result.scores.influence_score).toBeLessThanOrEqual(1000);
      expect(result.author_id).toBe('test_author_123');
      expect(result.handle).toBe('testuser');
    });

    it('should cap influence score at 1000', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 1.0,
          activity_weight: 100.0,
          total_engagement: 10000,
          weighted_engagement: 15000,
          engagement_ratio: 0.02,
          has_real_views: true,
        },
      });

      const result = computeInfluenceScore(metrics);

      expect(result.scores.influence_score).toBeLessThanOrEqual(1000);
    });

    it('should handle zero engagement', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0,
          activity_weight: 0,
          total_engagement: 0,
          weighted_engagement: 0,
          engagement_ratio: 0,
          has_real_views: false,
        },
      });

      const result = computeInfluenceScore(metrics);

      expect(result.scores.influence_score).toBe(0);
      expect(result.scores.risk_level).toBe('medium'); // Low score = medium risk
    });
  });

  describe('Risk level calculation', () => {
    it('should assign low risk for high scores with no red flags', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.7,
          activity_weight: 8.0,
          total_engagement: 500,
          weighted_engagement: 750,
          engagement_ratio: 0.025,
          has_real_views: true,
        },
      });

      const result = computeInfluenceScore(metrics);

      expect(result.scores.risk_level).toBe('low');
    });

    it('should assign high risk when multiple red flags present', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.001, // Very low
          activity_weight: 1.0,
          total_engagement: 5,
          weighted_engagement: 7,
          engagement_ratio: 0.6, // Suspiciously high
          has_real_views: false,
        },
      });

      const result = computeInfluenceScore(metrics);

      expect(result.scores.red_flags).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Red flags detection', () => {
    it('should detect abnormally high engagement ratio', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.5,
          activity_weight: 5.0,
          total_engagement: 100,
          weighted_engagement: 150,
          engagement_ratio: 0.55, // >50% is suspicious
          has_real_views: true,
        },
      });

      const result = computeInfluenceScore(metrics);

      expect(result.scores.red_flag_reasons).toContain(
        'Abnormally high engagement ratio (>50%) - possible manipulation'
      );
    });

    it('should detect elevated engagement ratio', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.5,
          activity_weight: 5.0,
          total_engagement: 100,
          weighted_engagement: 150,
          engagement_ratio: 0.15, // >10% is elevated
          has_real_views: true,
        },
      });

      const result = computeInfluenceScore(metrics);

      expect(result.scores.red_flag_reasons).toContain(
        'Elevated engagement ratio (>10%) - unusual pattern'
      );
    });

    it('should not flag normal engagement ratio', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.5,
          activity_weight: 5.0,
          total_engagement: 100,
          weighted_engagement: 150,
          engagement_ratio: 0.025, // 2.5% is normal
          has_real_views: true,
        },
      });

      const result = computeInfluenceScore(metrics);

      const ratioFlags = result.scores.red_flag_reasons.filter(
        r => r.includes('engagement ratio')
      );
      expect(ratioFlags.length).toBe(0);
    });
  });

  describe('Profile accumulation', () => {
    it('should accumulate posts count', () => {
      const metrics = createTestMetrics();
      const existingProfile = {
        activity: {
          posts_count: 5,
          total_engagement: 500,
          avg_engagement_quality: 0.4,
        },
        _engagement_history: [100, 110, 90, 105, 95],
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result.activity.posts_count).toBe(6);
    });

    it('should update engagement history for volatility', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.5,
          activity_weight: 5.0,
          total_engagement: 130,
          weighted_engagement: 170,
          engagement_ratio: 0.026,
          has_real_views: true,
        },
      });
      const existingProfile = {
        _engagement_history: [100, 110, 90],
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result._engagement_history).toHaveLength(4);
      expect(result._engagement_history).toContain(130);
    });

    it('should limit engagement history to 20 entries', () => {
      const metrics = createTestMetrics();
      const existingProfile = {
        _engagement_history: Array(25).fill(100),
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result._engagement_history!.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Volatility calculation', () => {
    it('should detect low volatility (consistent engagement)', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.5,
          activity_weight: 5.0,
          total_engagement: 100,
          weighted_engagement: 150,
          engagement_ratio: 0.02,
          has_real_views: true,
        },
      });
      // Very consistent history (all ~100)
      const existingProfile = {
        _engagement_history: [98, 102, 100, 99, 101, 100],
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result.activity.volatility).toBe('low');
    });

    it('should detect high volatility (erratic engagement)', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.5,
          activity_weight: 5.0,
          total_engagement: 500,
          weighted_engagement: 750,
          engagement_ratio: 0.02,
          has_real_views: true,
        },
      });
      // Erratic history
      const existingProfile = {
        _engagement_history: [10, 500, 50, 1000, 20, 800],
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result.activity.volatility).toBe('high');
    });

    it('should return unknown volatility for insufficient data', () => {
      const metrics = createTestMetrics();
      const existingProfile = {
        _engagement_history: [100], // Only 1 entry
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result.activity.volatility).toBe('unknown');
    });
  });

  describe('Engagement stability', () => {
    it('should detect high stability when quality is consistent', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.42, // Close to average of 0.4
          activity_weight: 5.0,
          total_engagement: 130,
          weighted_engagement: 170,
          engagement_ratio: 0.026,
          has_real_views: true,
        },
      });
      const existingProfile = {
        activity: {
          posts_count: 10,
          avg_engagement_quality: 0.4,
        },
        _engagement_history: Array(10).fill(100),
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result.activity.engagement_stability).toBe('high');
    });

    it('should detect low stability when quality varies significantly', () => {
      const metrics = createTestMetrics({
        normalized: {
          engagement_quality: 0.9, // Far from average of 0.3
          activity_weight: 5.0,
          total_engagement: 130,
          weighted_engagement: 170,
          engagement_ratio: 0.026,
          has_real_views: true,
        },
      });
      const existingProfile = {
        activity: {
          posts_count: 10,
          avg_engagement_quality: 0.3,
        },
        _engagement_history: Array(10).fill(100),
      };

      const result = computeInfluenceScore(metrics, existingProfile as any);

      expect(result.activity.engagement_stability).toBe('low');
    });
  });
});
