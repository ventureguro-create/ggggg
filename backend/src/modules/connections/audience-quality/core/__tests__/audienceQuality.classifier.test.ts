/**
 * Tests for AQE Follower Classifier
 */

import { describe, it, expect } from 'vitest';
import { classifyFollower } from '../audienceQuality.classifier.js';
import { DEFAULT_AQE_CONFIG } from '../../contracts/audienceQuality.config.js';

const cfg = DEFAULT_AQE_CONFIG;

describe('AQE Classifier', () => {
  describe('REAL classification', () => {
    it('should classify active established account as REAL', () => {
      const result = classifyFollower({
        followerId: 'user_123',
        username: 'real_user',
        profile: {
          createdAt: new Date(Date.now() - 200 * 86400_000).toISOString(), // 200 days old
          tweetsTotal: 150,
          tweetsLast30d: 20,
          followersCount: 500,
          followingCount: 300,
          avgLikes: 10,
          avgRetweets: 3,
          activityDaysLast30: 15,
          hasAvatar: true,
          hasBio: true,
        },
        cfg,
      });

      expect(result.label).toBe('REAL');
      expect(result.score).toBeGreaterThan(0.8);
    });
  });

  describe('LOW_QUALITY classification', () => {
    it('should classify passive account as LOW_QUALITY', () => {
      const result = classifyFollower({
        followerId: 'user_456',
        username: 'passive_user',
        profile: {
          createdAt: new Date(Date.now() - 60 * 86400_000).toISOString(), // 60 days old
          tweetsTotal: 10,
          tweetsLast30d: 1,
          followersCount: 20,
          followingCount: 100,
          avgLikes: 0,
          avgRetweets: 0,
          activityDaysLast30: 1,
          hasAvatar: true,
          hasBio: false,
        },
        cfg,
      });

      expect(result.label).toBe('LOW_QUALITY');
    });
  });

  describe('BOT_LIKELY classification', () => {
    it('should classify new mass-following empty account as BOT_LIKELY', () => {
      const result = classifyFollower({
        followerId: 'bot_789',
        username: 'bot123456',
        profile: {
          createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(), // 5 days old
          tweetsTotal: 2,
          tweetsLast30d: 0,
          followersCount: 5,
          followingCount: 1500,
          avgLikes: 0,
          avgRetweets: 0,
          activityDaysLast30: 0,
          hasAvatar: false,
          hasBio: false,
        },
        cfg,
      });

      expect(result.label).toBe('BOT_LIKELY');
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.reasons).toContain(`age<=${cfg.bot_max_age_days}`);
    });
  });

  describe('FARM_NODE classification', () => {
    it('should classify follow farm node correctly', () => {
      const result = classifyFollower({
        followerId: 'farm_001',
        username: 'follow_farm',
        profile: {
          createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
          tweetsTotal: 5,
          tweetsLast30d: 0,
          followersCount: 50,
          followingCount: 5000,
          avgLikes: 0,
          avgRetweets: 0,
          activityDaysLast30: 0,
          hasAvatar: false,
          hasBio: false,
        },
        cfg,
      });

      expect(result.label).toBe('FARM_NODE');
      expect(result.score).toBe(0.9);
      expect(result.reasons).toContain(`following>=${cfg.farm_min_following}`);
    });

    it('should prioritize FARM_NODE over BOT_LIKELY', () => {
      // Account that matches both BOT_LIKELY and FARM_NODE criteria
      const result = classifyFollower({
        followerId: 'farm_bot',
        username: 'farm_bot_user',
        profile: {
          createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(), // 7 days - matches BOT
          tweetsTotal: 2,
          tweetsLast30d: 0,
          followersCount: 10,        // matches FARM
          followingCount: 3000,      // matches FARM
          avgLikes: 0,
          avgRetweets: 0,
          activityDaysLast30: 0,
          hasAvatar: false,
          hasBio: false,
        },
        cfg,
      });

      // FARM_NODE takes priority
      expect(result.label).toBe('FARM_NODE');
    });
  });

  describe('Edge cases', () => {
    it('should handle missing data gracefully', () => {
      const result = classifyFollower({
        followerId: 'unknown',
        profile: {
          // All undefined/null
        },
        cfg,
      });

      // Should default to LOW_QUALITY with low confidence
      expect(result.label).toBe('LOW_QUALITY');
      expect(result.features.account_age_days).toBe(0);
    });
  });
});
