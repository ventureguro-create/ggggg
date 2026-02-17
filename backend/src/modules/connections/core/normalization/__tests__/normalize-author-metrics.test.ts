/**
 * Tests for Normalize Author Metrics
 * 
 * Tests:
 * - Views estimation when not provided
 * - Engagement quality calculation
 * - Engagement ratio calculation
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import { normalizeAuthorMetrics } from '../normalize-author-metrics.js';
import type { AuthorSignals } from '../../signals/extract-author-signals.js';

// Helper to create test signals
function createTestSignals(overrides: Partial<AuthorSignals> = {}): AuthorSignals {
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
    ...overrides,
  };
}

describe('normalizeAuthorMetrics', () => {
  describe('Basic normalization', () => {
    it('should calculate total engagement', () => {
      const signals = createTestSignals({
        metrics: { likes: 100, reposts: 20, replies: 10, views: 5000 },
      });

      const result = normalizeAuthorMetrics(signals);

      expect(result.normalized.total_engagement).toBe(130);
    });

    it('should calculate weighted engagement', () => {
      const signals = createTestSignals({
        metrics: { likes: 100, reposts: 20, replies: 10, views: 5000 },
      });

      const result = normalizeAuthorMetrics(signals);

      // likes*1 + reposts*2 + replies*3 = 100 + 40 + 30 = 170
      expect(result.normalized.weighted_engagement).toBe(170);
    });

    it('should calculate engagement quality with real views', () => {
      const signals = createTestSignals({
        metrics: { likes: 100, reposts: 20, replies: 10, views: 5000 },
      });

      const result = normalizeAuthorMetrics(signals);

      // weighted (170) / views (5000) = 0.034
      expect(result.normalized.engagement_quality).toBeCloseTo(0.034, 2);
      expect(result.normalized.has_real_views).toBe(true);
    });
  });

  describe('Views estimation', () => {
    it('should estimate views when not provided (null)', () => {
      const signals = createTestSignals({
        metrics: { likes: 100, reposts: 20, replies: 10, views: null },
      });

      const result = normalizeAuthorMetrics(signals);

      expect(result.normalized.has_real_views).toBe(false);
      // Should use estimated views based on 2% engagement rate
      // totalEngagement (130) / 0.02 = 6500 estimated views
      // engagement_quality = weighted (170) / estimated views (6500)
      expect(result.normalized.engagement_quality).toBeGreaterThan(0);
    });

    it('should estimate views when zero', () => {
      const signals = createTestSignals({
        metrics: { likes: 100, reposts: 20, replies: 10, views: 0 },
      });

      const result = normalizeAuthorMetrics(signals);

      expect(result.normalized.has_real_views).toBe(false);
      expect(result.normalized.engagement_quality).toBeGreaterThan(0);
    });

    it('should use minimum views for zero engagement', () => {
      const signals = createTestSignals({
        metrics: { likes: 0, reposts: 0, replies: 0, views: null },
      });

      const result = normalizeAuthorMetrics(signals);

      expect(result.normalized.total_engagement).toBe(0);
      expect(result.normalized.engagement_quality).toBe(0);
    });
  });

  describe('Engagement ratio', () => {
    it('should calculate engagement ratio correctly', () => {
      const signals = createTestSignals({
        metrics: { likes: 100, reposts: 20, replies: 10, views: 5000 },
      });

      const result = normalizeAuthorMetrics(signals);

      // total_engagement (130) / views (5000) = 0.026
      expect(result.normalized.engagement_ratio).toBeCloseTo(0.026, 3);
    });

    it('should handle high engagement ratio', () => {
      const signals = createTestSignals({
        metrics: { likes: 500, reposts: 200, replies: 100, views: 1000 },
      });

      const result = normalizeAuthorMetrics(signals);

      // total_engagement (800) / views (1000) = 0.8
      expect(result.normalized.engagement_ratio).toBeCloseTo(0.8, 1);
    });
  });

  describe('Activity weight', () => {
    it('should use log scale for activity weight', () => {
      const signals = createTestSignals({
        metrics: { likes: 100, reposts: 20, replies: 10, views: 5000 },
      });

      const result = normalizeAuthorMetrics(signals);

      // log1p(130) ≈ 4.88
      expect(result.normalized.activity_weight).toBeCloseTo(4.88, 1);
    });

    it('should handle very high engagement with log scale', () => {
      const signals = createTestSignals({
        metrics: { likes: 100000, reposts: 20000, replies: 10000, views: 5000000 },
      });

      const result = normalizeAuthorMetrics(signals);

      // Log scale prevents extreme values
      expect(result.normalized.activity_weight).toBeLessThan(20);
    });
  });

  describe('Edge cases', () => {
    it('should cap engagement quality at 1', () => {
      const signals = createTestSignals({
        metrics: { likes: 1000, reposts: 500, replies: 500, views: 100 },
      });

      const result = normalizeAuthorMetrics(signals);

      expect(result.normalized.engagement_quality).toBeLessThanOrEqual(1);
    });

    it('should preserve original signal data', () => {
      const signals = createTestSignals({
        author_id: 'unique_author',
        handle: 'unique_handle',
      });

      const result = normalizeAuthorMetrics(signals);

      expect(result.author_id).toBe('unique_author');
      expect(result.handle).toBe('unique_handle');
      expect(result.metrics).toEqual(signals.metrics);
    });

    it('should handle all zeros', () => {
      const signals = createTestSignals({
        metrics: { likes: 0, reposts: 0, replies: 0, views: 0 },
      });

      const result = normalizeAuthorMetrics(signals);

      expect(result.normalized.total_engagement).toBe(0);
      expect(result.normalized.weighted_engagement).toBe(0);
      expect(result.normalized.engagement_quality).toBe(0);
      expect(result.normalized.activity_weight).toBe(0);
    });
  });
});
