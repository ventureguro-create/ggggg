/**
 * Tests for AQE Anomaly Detection
 */

import { describe, it, expect } from 'vitest';
import { computeAnomaly } from '../audienceQuality.anomaly.js';
import { DEFAULT_AQE_CONFIG } from '../../contracts/audienceQuality.config.js';

const cfg = DEFAULT_AQE_CONFIG;

describe('AQE Anomaly Detection', () => {
  it('should detect growth spike', () => {
    const followersSeries = [];
    for (let i = 0; i < 14; i++) {
      // Normal growth: +10-20 followers per day
      followersSeries.push({
        ts: new Date(Date.now() - (14 - i) * 86400_000).toISOString(),
        followers: 1000 + i * 15,
      });
    }
    // Spike on last day: +500 instead of +15
    followersSeries.push({
      ts: new Date().toISOString(),
      followers: 1710, // Normal would be ~1210
    });

    const result = computeAnomaly({
      followersSeries,
      engagementSeries: [],
      cfg,
    });

    expect(result.growth_spike).toBe(true);
  });

  it('should detect engagement flat', () => {
    const followersSeries = [];
    const engagementSeries = [];
    
    for (let i = 0; i < 14; i++) {
      const ts = new Date(Date.now() - (14 - i) * 86400_000).toISOString();
      
      // Growing followers
      followersSeries.push({
        ts,
        followers: 1000 + i * 100,
      });
      
      // Flat engagement
      engagementSeries.push({
        ts,
        engagement: 50 + (i % 3), // Nearly flat
      });
    }

    const result = computeAnomaly({
      followersSeries,
      engagementSeries,
      cfg,
    });

    expect(result.engagement_flat).toBe(true);
  });

  it('should flag anomaly when growth spike AND engagement flat', () => {
    const followersSeries = [];
    const engagementSeries = [];
    
    // Normal days
    for (let i = 0; i < 13; i++) {
      const ts = new Date(Date.now() - (13 - i) * 86400_000).toISOString();
      followersSeries.push({ ts, followers: 1000 + i * 10 });
      engagementSeries.push({ ts, engagement: 100 });
    }
    
    // Spike day with flat engagement
    followersSeries.push({
      ts: new Date().toISOString(),
      followers: 2000, // Big spike
    });
    engagementSeries.push({
      ts: new Date().toISOString(),
      engagement: 102, // Still flat
    });

    const result = computeAnomaly({
      followersSeries,
      engagementSeries,
      cfg,
    });

    expect(result.anomaly).toBe(true);
    expect(result.notes).toContain('ANOMALY_DETECTED');
  });

  it('should NOT flag anomaly with organic growth', () => {
    const followersSeries = [];
    const engagementSeries = [];
    
    for (let i = 0; i < 14; i++) {
      const ts = new Date(Date.now() - (14 - i) * 86400_000).toISOString();
      // Organic growth correlation
      followersSeries.push({ ts, followers: 1000 + i * 20 });
      engagementSeries.push({ ts, engagement: 100 + i * 10 });
    }

    const result = computeAnomaly({
      followersSeries,
      engagementSeries,
      cfg,
    });

    expect(result.anomaly).toBe(false);
  });

  it('should handle insufficient data', () => {
    const result = computeAnomaly({
      followersSeries: [
        { ts: new Date().toISOString(), followers: 1000 },
      ],
      engagementSeries: [],
      cfg,
    });

    expect(result.anomaly).toBe(false);
    expect(result.notes).toContain('INSUFFICIENT_DATA');
  });
});
