/**
 * Twitter Author Snapshot Contract
 * 
 * Represents a point-in-time snapshot of a Twitter author's profile.
 * Used by adapter to normalize data from Twitter Parser storage.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 */

export interface TwitterAuthorSnapshot {
  // Identity
  author_id: string;          // Twitter user ID
  username: string;           // @handle without @
  display_name?: string;      // Full name
  
  // Metrics
  followers: number;
  following: number;
  
  // Profile
  verified: boolean;
  avatar_url?: string;
  
  // Timestamps
  account_created_at?: Date;  // When account was created on Twitter
  collected_at: Date;         // When this snapshot was taken
  
  // Source tracking
  source_session_id?: string;
  source_task_id?: string;
}

/**
 * Minimal author info from tweet data
 */
export interface TwitterAuthorMinimal {
  author_id: string;
  username: string;
  display_name?: string;
  verified?: boolean;
  followers?: number;
}
