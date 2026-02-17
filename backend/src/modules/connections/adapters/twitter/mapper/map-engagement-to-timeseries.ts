/**
 * Map Twitter Engagement to Time Series
 * 
 * Converts TwitterEngagementEvent into Connections time-series points.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 */

import type { TwitterEngagementEvent, TwitterEngagementAggregated } from '../contracts/index.js';

/**
 * Connections time-series point format
 */
export interface ConnectionsTimeSeriesPoint {
  author_id: string;
  date: Date;
  
  // Engagement metrics
  likes: number;
  reposts: number;
  replies: number;
  quotes?: number;
  views?: number;
  
  // Calculated
  engagement_total: number;
  engagement_rate?: number;  // if views available
  
  // Source
  source: 'twitter';
  tweet_ids?: string[];
}

/**
 * Map single engagement event to time-series point
 */
export function mapEngagementToTimeSeries(
  event: TwitterEngagementEvent
): ConnectionsTimeSeriesPoint {
  const engagementTotal = event.likes + event.reposts + event.replies + (event.quotes || 0);
  const engagementRate = event.views && event.views > 0
    ? (engagementTotal / event.views) * 100
    : undefined;
  
  return {
    author_id: event.author_id,
    date: event.tweet_timestamp,
    
    likes: event.likes,
    reposts: event.reposts,
    replies: event.replies,
    quotes: event.quotes,
    views: event.views,
    
    engagement_total: engagementTotal,
    engagement_rate: engagementRate ? Math.round(engagementRate * 100) / 100 : undefined,
    
    source: 'twitter',
    tweet_ids: [event.tweet_id],
  };
}

/**
 * Map aggregated engagement to time-series point
 */
export function mapAggregatedToTimeSeries(
  agg: TwitterEngagementAggregated
): ConnectionsTimeSeriesPoint {
  const engagementTotal = agg.likes_total + agg.reposts_total + agg.replies_total;
  const engagementRate = agg.views_total && agg.views_total > 0
    ? (engagementTotal / agg.views_total) * 100
    : undefined;
  
  return {
    author_id: agg.author_id,
    date: agg.window_start,
    
    likes: agg.likes_total,
    reposts: agg.reposts_total,
    replies: agg.replies_total,
    views: agg.views_total,
    
    engagement_total: engagementTotal,
    engagement_rate: engagementRate ? Math.round(engagementRate * 100) / 100 : undefined,
    
    source: 'twitter',
  };
}

/**
 * Aggregate events by author and day
 */
export function aggregateEngagementsByDay(
  events: TwitterEngagementEvent[]
): TwitterEngagementAggregated[] {
  const byAuthorDay = new Map<string, TwitterEngagementEvent[]>();
  
  for (const event of events) {
    const day = new Date(event.tweet_timestamp);
    day.setHours(0, 0, 0, 0);
    const key = `${event.author_id}:${day.toISOString()}`;
    
    if (!byAuthorDay.has(key)) {
      byAuthorDay.set(key, []);
    }
    byAuthorDay.get(key)!.push(event);
  }
  
  const results: TwitterEngagementAggregated[] = [];
  
  for (const [key, dayEvents] of byAuthorDay) {
    const [authorId, dayStr] = key.split(':');
    const windowStart = new Date(dayStr);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 1);
    
    const agg: TwitterEngagementAggregated = {
      author_id: authorId,
      window_start: windowStart,
      window_end: windowEnd,
      tweets_count: dayEvents.length,
      likes_total: dayEvents.reduce((sum, e) => sum + e.likes, 0),
      reposts_total: dayEvents.reduce((sum, e) => sum + e.reposts, 0),
      replies_total: dayEvents.reduce((sum, e) => sum + e.replies, 0),
      views_total: dayEvents.reduce((sum, e) => sum + (e.views || 0), 0),
      likes_avg: 0,
      reposts_avg: 0,
    };
    
    agg.likes_avg = Math.round(agg.likes_total / agg.tweets_count);
    agg.reposts_avg = Math.round(agg.reposts_total / agg.tweets_count);
    
    results.push(agg);
  }
  
  return results.sort((a, b) => a.window_start.getTime() - b.window_start.getTime());
}

/**
 * Map multiple events to time-series (aggregated by day)
 */
export function mapEngagementsToTimeSeries(
  events: TwitterEngagementEvent[]
): ConnectionsTimeSeriesPoint[] {
  const aggregated = aggregateEngagementsByDay(events);
  return aggregated.map(mapAggregatedToTimeSeries);
}
