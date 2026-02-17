/**
 * Feedback Types (Phase 5.3)
 */

export type FeedbackLabel = 
  | 'CORRECT'        // Alert was useful
  | 'FALSE_POSITIVE' // Alert was wrong
  | 'NOISE'          // Alert was spam/useless
  | 'TOO_EARLY'      // Alert was premature
  | 'UNKNOWN';       // No feedback yet

export type FeedbackSource = 'ADMIN' | 'USER' | 'SYSTEM';

export interface AlertFeedback {
  _id?: any;
  alert_id: string;
  account_id: string;
  account_handle?: string;
  alert_type: string;
  
  // Decision that was made
  decision: 'SEND' | 'SEND_LOW_PRIORITY' | 'SUPPRESS';
  
  // Feedback
  feedback: FeedbackLabel;
  feedback_source: FeedbackSource;
  feedback_by?: string;
  feedback_note?: string;
  
  // Snapshot at time of alert
  confidence: number;
  aqm_score: number;
  aqm_label: string;
  patterns: string[];
  pattern_risk: number;
  twitter_score: number;
  network_score: number;
  early_signal_score: number;
  smart_followers_pct: number;
  
  // Temporal
  alert_timestamp: string;
  feedback_timestamp?: string;
  time_to_feedback_hours?: number;
  
  // ML tracking
  ml_adjustment_applied?: number;
  ml_version?: string;
}

export interface FeedbackStats {
  total: number;
  correct: number;
  false_positive: number;
  noise: number;
  too_early: number;
  unknown: number;
  fp_rate: number;
  by_alert_type: Record<string, { total: number; fp: number; fp_rate: number }>;
  by_pattern: Record<string, { total: number; fp: number; fp_rate: number }>;
}

export interface MLModelInfo {
  version: string;
  trained_at: string;
  dataset_size: number;
  fp_rate_before: number;
  fp_rate_after: number;
  avg_adjustment: number;
  enabled: boolean;
}
