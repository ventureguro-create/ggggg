/**
 * Twitter Confidence Score Contracts
 * 
 * Defines the interface for confidence scoring of Twitter data.
 * 
 * PHASE 4.1.6 — Twitter Confidence Score v1.0
 */

/**
 * Confidence labels based on score thresholds
 */
export type TwitterConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';

/**
 * Components that make up the confidence score
 */
export interface TwitterConfidenceComponents {
  freshness: number;       // 0-1: How recent is the data
  consistency: number;     // 0-1: No gaps/jumps in data
  coverage: number;        // 0-1: Completeness of data sources
  anomaly_health: number;  // 0-1: Absence of anomalies
  source_trust: number;    // 0-1: Trust level of data source
}

/**
 * Full confidence score result
 */
export interface TwitterConfidenceResult {
  score_0_1: number;
  label: TwitterConfidenceLabel;
  components: TwitterConfidenceComponents;
  warnings: string[];
  meta: {
    computed_at: string;
    input_age_hours?: number;
    window_days?: number;
    source: 'parser_storage' | 'mock' | 'unknown';
  };
}

/**
 * Input for confidence computation
 */
export interface TwitterConfidenceInput {
  author_id: string;
  
  // Freshness
  data_age_hours: number;           // Age of the most recent data point
  
  // Coverage flags
  has_profile_meta: boolean;        // Has basic profile info
  has_engagement: boolean;          // Has engagement/tweet data
  has_follow_graph: boolean;        // Has followers/following data
  
  // Consistency indicators
  time_series_gaps?: number;        // Number of missing data points
  volatility_score?: number;        // 0-1, higher = more volatile
  
  // Anomaly flags from guards
  anomaly_flags?: {
    spike_detected?: boolean;
    duplicates_rate?: number;       // 0-1, % of duplicates
    suspicious_ratios?: boolean;
    rate_limited?: boolean;
  };
  
  // Source
  source_type?: 'parser_storage' | 'mock' | 'user_triggered' | 'api_fallback';
}

/**
 * Dampening result for adapter
 */
export interface DampeningResult {
  should_dampen: boolean;
  multiplier: number;           // 0.35 - 1.0
  reason?: string;
}

/**
 * Stats aggregation
 */
export interface TwitterConfidenceStats {
  period: '24h' | '7d' | '30d';
  total_computations: number;
  by_label: Record<TwitterConfidenceLabel, number>;
  avg_score: number;
  warnings_count: number;
  blocked_alerts_count: number;
}
