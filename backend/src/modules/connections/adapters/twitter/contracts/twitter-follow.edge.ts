/**
 * Twitter Follow Edge Contract
 * 
 * Represents a follow relationship between two accounts.
 * Used by adapter to build network graph.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 */

export interface TwitterFollowEdge {
  // Relationship
  from_id: string;            // follower
  to_id: string;              // followed (target)
  
  // Metadata
  from_username?: string;
  to_username?: string;
  
  // Time (if available)
  discovered_at: Date;        // When we found this relationship
  
  // Source
  source_session_id?: string;
  source_task_id?: string;
}

/**
 * Author's followers/following summary
 */
export interface TwitterFollowSummary {
  author_id: string;
  username: string;
  
  // Counts
  followers_count: number;
  following_count: number;
  
  // Captured lists (if available)
  followers_sample?: TwitterFollowEdge[];
  following_sample?: TwitterFollowEdge[];
  
  // Quality indicators
  followers_verified_count?: number;
  followers_avg_followers?: number;
  
  collected_at: Date;
}
