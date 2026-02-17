/**
 * AI Summary Contracts (Phase 3.5)
 * 
 * Types and schemas for AI interpretation layer
 * AI reads ONLY computed metrics, never raw Twitter data
 */

import { z } from 'zod';

// ============================================================
// INPUT SCHEMAS
// ============================================================

export const AiSummaryInputSchema = z.object({
  account_id: z.string().min(1),
  mode: z.enum(['summary', 'explain', 'event']).default('summary'),
  
  // Computed metrics snapshot - AI only sees aggregates
  snapshot: z.object({
    twitter_score_0_1000: z.number().min(0).max(1000),
    grade: z.string().optional(),
    
    // Score components
    influence_0_1000: z.number().min(0).max(1000).optional(),
    quality_0_1: z.number().min(0).max(1).optional(),
    trend_0_1: z.number().min(0).max(1).optional(),
    network_0_1: z.number().min(0).max(1).optional(),
    consistency_0_1: z.number().min(0).max(1).optional(),
    
    // Audience & Authority
    audience_quality_0_1: z.number().min(0).max(1).optional(),
    authority_0_1: z.number().min(0).max(1).optional(),
    smart_followers_0_100: z.number().min(0).max(100).optional(),
    
    // Network hops
    hops: z.object({
      avg_hops_to_top: z.number().min(0).max(10).optional(),
      elite_exposure_share_0_1: z.number().min(0).max(1).optional(),
      examples: z.array(z.string()).optional(),
    }).optional(),
    
    // Trends
    trends: z.object({
      velocity_pts_per_day: z.number().optional(),
      acceleration: z.number().optional(),
      state: z.enum(['growing', 'cooling', 'volatile', 'stable']).optional(),
    }).optional(),
    
    // Early signals
    early_signal: z.object({
      score: z.number().min(0).max(1000).optional(),
      badge: z.enum(['none', 'rising', 'breakout']).optional(),
    }).optional(),
    
    // Risk indicators
    red_flags: z.array(z.string()).optional(),
    
    // Data confidence (Phase 4.1.6)
    twitter_confidence_score_0_100: z.number().min(0).max(100).optional(),
  }),
  
  // For event mode
  event: z.object({
    type: z.enum(['EARLY_BREAKOUT', 'STRONG_ACCELERATION', 'TREND_REVERSAL']).optional(),
    window: z.string().optional(),
  }).optional(),
});

export type AiSummaryInput = z.infer<typeof AiSummaryInputSchema>;

// ============================================================
// OUTPUT SCHEMAS
// ============================================================

export const VerdictType = z.enum([
  'STRONG',
  'GOOD', 
  'MIXED',
  'RISKY',
  'INSUFFICIENT_DATA',
]);

export type Verdict = z.infer<typeof VerdictType>;

export const AiSummaryOutputSchema = z.object({
  version: z.string(),
  model: z.string(),
  language: z.enum(['en', 'ru', 'ua']).default('en'),
  
  // Main content
  headline: z.string(),
  summary: z.string(),
  verdict: VerdictType,
  
  // Structured insights
  key_drivers: z.array(z.string()).max(7),
  risks: z.array(z.string()).max(7),
  recommendations: z.array(z.string()).max(7),
  
  // Evidence linkage
  evidence: z.object({
    score: z.number().min(0).max(1000),
    grade: z.string().optional(),
    confidence_0_100: z.number().min(0).max(100).optional(),
    notable: z.array(z.string()).max(10).optional(),
  }),
  
  // For Telegram/events
  telegram: z.object({
    title: z.string().optional(),
    text: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export type AiSummaryOutput = z.infer<typeof AiSummaryOutputSchema>;

// ============================================================
// CONFIG SCHEMA
// ============================================================

export const AiConfigSchema = z.object({
  enabled: z.boolean(),
  model: z.string(),
  max_output_tokens: z.number().min(100).max(2000),
  temperature: z.number().min(0).max(1),
  min_confidence_to_run: z.number().min(0).max(100),
  cache_ttl_sec: z.number().min(0),
  language: z.enum(['en', 'ru', 'ua']),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

// Warning codes for insufficient data
export const WarningCodes = {
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  MISSING_AUDIENCE: 'MISSING_AUDIENCE',
  MISSING_NETWORK: 'MISSING_NETWORK',
  MISSING_TRENDS: 'MISSING_TRENDS',
  AI_DISABLED: 'AI_DISABLED',
} as const;
