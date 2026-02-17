/**
 * Engagement Mapper
 * 
 * Maps raw tweet data to Connections EngagementEvent format.
 */

import type { EngagementEvent } from '../readers/twitterEngagement.reader.js';

export interface ConnectionsEngagement {
  event_id: string;
  profile_id: string;
  timestamp: Date;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    views: number;
    engagement_rate: number;
  };
  source: 'twitter' | 'mock';
  source_metadata: {
    tweet_id?: string;
    session_id?: string;
    task_id?: string;
    collected_at?: Date;
  };
}

/**
 * Map EngagementEvent to ConnectionsEngagement
 */
export function mapEngagementToConnections(event: EngagementEvent): ConnectionsEngagement {
  const totalEngagement = event.likes + event.reposts + event.replies;
  const engagementRate = event.views > 0 ? totalEngagement / event.views : 0;

  return {
    event_id: event.tweet_id,
    profile_id: event.author_id || event.username,
    timestamp: event.created_at,
    metrics: {
      likes: normalizeMetric(event.likes),
      reposts: normalizeMetric(event.reposts),
      replies: normalizeMetric(event.replies),
      views: normalizeMetric(event.views),
      engagement_rate: engagementRate,
    },
    source: 'twitter',
    source_metadata: {
      tweet_id: event.tweet_id,
      session_id: event.source_session_id,
      task_id: event.source_task_id,
      collected_at: event.collected_at,
    },
  };
}

/**
 * Map multiple events
 */
export function mapEngagementsToConnections(events: EngagementEvent[]): ConnectionsEngagement[] {
  return events.map(mapEngagementToConnections);
}

/**
 * Normalize metric (ensure non-negative integer)
 */
function normalizeMetric(value: number | undefined | null): number {
  if (value === undefined || value === null || isNaN(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * Aggregate engagements by profile
 */
export function aggregateByProfile(events: EngagementEvent[]): Map<string, {
  profile_id: string;
  total_tweets: number;
  total_likes: number;
  total_reposts: number;
  total_replies: number;
  total_views: number;
  avg_engagement_rate: number;
  first_seen: Date;
  last_seen: Date;
}> {
  const map = new Map();

  for (const event of events) {
    const id = event.author_id || event.username;
    const existing = map.get(id) || {
      profile_id: id,
      total_tweets: 0,
      total_likes: 0,
      total_reposts: 0,
      total_replies: 0,
      total_views: 0,
      avg_engagement_rate: 0,
      first_seen: event.created_at,
      last_seen: event.created_at,
    };

    existing.total_tweets++;
    existing.total_likes += event.likes;
    existing.total_reposts += event.reposts;
    existing.total_replies += event.replies;
    existing.total_views += event.views;

    if (event.created_at < existing.first_seen) existing.first_seen = event.created_at;
    if (event.created_at > existing.last_seen) existing.last_seen = event.created_at;

    const totalEng = existing.total_likes + existing.total_reposts + existing.total_replies;
    existing.avg_engagement_rate = existing.total_views > 0 ? totalEng / existing.total_views : 0;

    map.set(id, existing);
  }

  return map;
}
