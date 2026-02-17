/**
 * Pattern Detection Types (Phase 5.2)
 */

export type PatternFlag = 
  | 'LIKE_FARM'        // A: Like/Reply imbalance
  | 'SPIKE_PUMP'       // B: Engagement spike
  | 'OVERLAP_FARM'     // C: Cross-audience farm
  | 'REPLY_BAIT'       // D: Future
  | 'POISONING';       // E: Future

export type PatternSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PatternInput {
  // Engagement metrics
  likes: number;
  replies: number;
  reposts: number;
  engagement_rate: number;
  
  // Time series (last 14 days)
  engagement_history?: number[];
  
  // Network
  overlap_pressure: number;
  audience_purity: number;
  
  // Graph
  new_edges_24h?: number;
  divergence_pct?: number;
  
  // Meta
  account_id?: string;
}

export interface PatternResult {
  risk_score: number;           // 0-100
  flags: PatternFlag[];
  severity: PatternSeverity;
  explain: string[];
  recommended_actions: Array<'DEGRADE_CONFIDENCE' | 'SUPPRESS_ALERTS' | 'REQUIRE_MORE_DATA' | 'NONE'>;
}
