/**
 * Twitter Live Diff
 * 
 * Compare mock vs live Twitter data.
 * Score delta, confidence delta, status flags.
 */

import { Db } from 'mongodb';
import { readLiveTwitterData, checkDataAvailability } from './twitterLive.reader.js';

export type DiffStatus = 'NO_DATA' | 'PARTIAL' | 'DIVERGENT' | 'OK';

export interface MockVsLiveDiff {
  status: DiffStatus;
  mock: {
    authors_count: number;
    engagements_count: number;
    avg_score: number;
  };
  live: {
    authors_count: number;
    engagements_count: number;
    avg_engagement_rate: number;
  };
  delta: {
    authors: number;
    authors_pct: number;
    engagements: number;
    engagements_pct: number;
    score_impact: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  };
  confidence: {
    mock: number;
    live: number;
    delta: number;
    capped: boolean;
    cap_reason?: string;
  };
  flags: string[];
  recommendation: string;
}

/**
 * Compare mock vs live data
 */
export async function compareMockVsLive(
  db: Db,
  mockData: {
    authors_count: number;
    engagements_count: number;
    avg_score: number;
    confidence: number;
  }
): Promise<MockVsLiveDiff> {
  const result: MockVsLiveDiff = {
    status: 'NO_DATA',
    mock: { authors_count: mockData.authors_count, engagements_count: mockData.engagements_count, avg_score: mockData.avg_score },
    live: { authors_count: 0, engagements_count: 0, avg_engagement_rate: 0 },
    delta: { authors: 0, authors_pct: 0, engagements: 0, engagements_pct: 0, score_impact: 'NONE' },
    confidence: { mock: mockData.confidence, live: 0, delta: 0, capped: true, cap_reason: 'No live data' },
    flags: [],
    recommendation: 'No action - live data not available',
  };

  const availability = await checkDataAvailability(db);
  
  if (!availability.available) {
    result.flags.push('NO_TWITTER_DATA');
    return result;
  }

  const liveData = await readLiveTwitterData(db, { limit: 500 });
  
  if (!liveData.success || liveData.data.total_tweets === 0) {
    result.status = 'NO_DATA';
    result.flags.push('LIVE_READ_FAILED');
    return result;
  }

  // Populate live stats
  result.live.authors_count = liveData.data.unique_authors;
  result.live.engagements_count = liveData.data.total_tweets;
  
  // Calculate avg engagement rate from tweets
  let totalEngagement = 0;
  let totalViews = 0;
  for (const tweet of liveData.data.tweets) {
    totalEngagement += (tweet.likes || 0) + (tweet.reposts || 0) + (tweet.replies || 0);
    totalViews += tweet.views || 0;
  }
  result.live.avg_engagement_rate = totalViews > 0 ? totalEngagement / totalViews : 0;

  // Calculate deltas
  result.delta.authors = result.live.authors_count - result.mock.authors_count;
  result.delta.authors_pct = result.mock.authors_count > 0 ? (result.delta.authors / result.mock.authors_count) * 100 : 0;
  result.delta.engagements = result.live.engagements_count - result.mock.engagements_count;
  result.delta.engagements_pct = result.mock.engagements_count > 0 ? (result.delta.engagements / result.mock.engagements_count) * 100 : 0;

  // Determine score impact
  const absDeltaPct = Math.abs(result.delta.authors_pct);
  if (absDeltaPct < 10) result.delta.score_impact = 'LOW';
  else if (absDeltaPct < 30) result.delta.score_impact = 'MEDIUM';
  else result.delta.score_impact = 'HIGH';

  // Confidence calculation (capped at 0.75 without graph)
  const liveConfidence = Math.min(0.75, 
    (result.live.authors_count > 0 ? 0.3 : 0) +
    (result.live.engagements_count > 10 ? 0.3 : 0.1) +
    (liveData.freshness.avg_age_hours < 24 ? 0.15 : 0)
  );
  result.confidence.live = liveConfidence;
  result.confidence.delta = liveConfidence - result.confidence.mock;
  result.confidence.capped = true;
  result.confidence.cap_reason = 'Graph disabled - max confidence 0.75';

  // Determine status
  if (result.live.authors_count === 0) {
    result.status = 'NO_DATA';
  } else if (result.live.authors_count < result.mock.authors_count * 0.5) {
    result.status = 'PARTIAL';
    result.flags.push('LOW_COVERAGE');
  } else if (Math.abs(result.delta.authors_pct) > 50) {
    result.status = 'DIVERGENT';
    result.flags.push('HIGH_DIVERGENCE');
  } else {
    result.status = 'OK';
  }

  // Recommendation
  switch (result.status) {
    case 'NO_DATA':
      result.recommendation = 'Run Twitter parser to collect data before enabling live mode';
      break;
    case 'PARTIAL':
      result.recommendation = 'Increase parser coverage before switching to live data';
      break;
    case 'DIVERGENT':
      result.recommendation = 'Review data quality - significant difference between mock and live';
      break;
    case 'OK':
      result.recommendation = 'Data looks consistent - safe to increase participation weight';
      break;
  }

  console.log(`[TwitterDiff] Status: ${result.status}, Delta: ${result.delta.authors_pct.toFixed(1)}%`);
  return result;
}

/**
 * Get quick diff summary
 */
export async function getQuickDiffSummary(db: Db): Promise<{
  status: DiffStatus;
  live_authors: number;
  live_tweets: number;
  freshness_hours: number;
  recommendation: string;
}> {
  const availability = await checkDataAvailability(db);
  
  if (!availability.available) {
    return { status: 'NO_DATA', live_authors: 0, live_tweets: 0, freshness_hours: 0, recommendation: 'No Twitter data available' };
  }

  const liveData = await readLiveTwitterData(db, { limit: 100 });
  
  return {
    status: liveData.data.total_tweets > 0 ? 'OK' : 'NO_DATA',
    live_authors: liveData.data.unique_authors,
    live_tweets: liveData.data.total_tweets,
    freshness_hours: liveData.freshness.avg_age_hours,
    recommendation: liveData.data.total_tweets > 0 ? 'Live data available' : 'No fresh data',
  };
}
