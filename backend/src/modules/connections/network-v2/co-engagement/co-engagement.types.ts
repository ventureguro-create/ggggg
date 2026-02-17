/**
 * Co-Engagement Types - Network v2
 * 
 * Types for building network graph from co-engagement patterns
 * WITHOUT requiring follow data
 */

// ============================================================
// CO-ENGAGEMENT EDGE
// ============================================================

export interface CoEngagementEdge {
  source_id: string;
  target_id: string;
  similarity: number;        // 0-1 cosine/pearson similarity
  shared_interactions: number;
  co_liked_authors: string[];
  co_replied_authors: string[];
  temporal_sync: number;     // 0-1 how synchronized their activity is
  confidence: number;        // 0-1
  computed_at: string;
}

// ============================================================
// TIME-SERIES VECTOR (per author)
// ============================================================

export interface AuthorActivityVector {
  author_id: string;
  handle: string;
  
  // Activity counts over window
  tweets_count: number;
  likes_given: number;
  replies_given: number;
  retweets_given: number;
  
  // Who they interact with (normalized counts)
  liked_authors: Map<string, number>;
  replied_to_authors: Map<string, number>;
  retweeted_authors: Map<string, number>;
  
  // Temporal pattern (buckets)
  hourly_activity: number[];  // 24 buckets
  daily_activity: number[];   // 7 buckets
  
  // Engagement received
  engagement_received: number;
  elite_engagement_received: number;
  
  // Metadata
  window_days: number;
  first_activity: string;
  last_activity: string;
}

// ============================================================
// CO-ENGAGEMENT CONFIG
// ============================================================

export interface CoEngagementConfig {
  // Time window
  window_days: number;        // 14
  min_tweets: number;         // 3
  
  // Similarity
  similarity_method: 'cosine' | 'pearson';
  min_similarity: number;     // 0.3
  
  // Graph limits
  top_k_per_node: number;     // 10
  max_edges: number;          // 5000
  max_nodes: number;          // 1000
  
  // Confidence
  min_shared_interactions: number;  // 2
  confidence_boost_for_temporal_sync: number;  // 0.1
}

export const DEFAULT_COENG_CONFIG: CoEngagementConfig = {
  window_days: 14,
  min_tweets: 3,
  
  similarity_method: 'cosine',
  min_similarity: 0.30,
  
  top_k_per_node: 10,
  max_edges: 5000,
  max_nodes: 1000,
  
  min_shared_interactions: 2,
  confidence_boost_for_temporal_sync: 0.1,
};

// ============================================================
// CO-ENGAGEMENT RESULT
// ============================================================

export interface CoEngagementResult {
  edges: CoEngagementEdge[];
  nodes: string[];
  stats: {
    total_nodes: number;
    total_edges: number;
    avg_similarity: number;
    avg_confidence: number;
    clusters_detected: number;
    window_days: number;
    computed_at: string;
  };
}

console.log('[CoEngagement] Types module loaded');
