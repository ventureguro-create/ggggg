/**
 * Twitter Engagement Event Contract
 * 
 * Represents engagement metrics for a single tweet.
 * Used by adapter to build time-series and engagement signals.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 */

export interface TwitterEngagementEvent {
  // Identity
  author_id: string;
  tweet_id: string;
  
  // Metrics
  likes: number;
  reposts: number;
  replies: number;
  quotes?: number;
  views?: number;
  
  // Content
  text?: string;
  has_media?: boolean;
  
  // Time
  tweet_timestamp: Date;      // When tweet was posted
  collected_at: Date;         // When metrics were captured
  
  // Source
  source_type: 'SEARCH' | 'ACCOUNT';
  source_query?: string;      // For SEARCH source
  source_session_id?: string;
}

/**
 * Aggregated engagement stats per author per time window
 */
export interface TwitterEngagementAggregated {
  author_id: string;
  window_start: Date;
  window_end: Date;
  
  // Totals
  tweets_count: number;
  likes_total: number;
  reposts_total: number;
  replies_total: number;
  views_total?: number;
  
  // Averages
  likes_avg: number;
  reposts_avg: number;
  engagement_rate?: number;
}
