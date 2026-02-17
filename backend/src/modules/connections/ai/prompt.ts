/**
 * AI Summary Prompts (Phase 3.5)
 * 
 * Structured prompts for deterministic AI output
 * AI MUST NOT invent data - only interpret provided metrics
 */

import type { AiSummaryInput } from './contracts.js';

/**
 * System instructions - enforces determinism and safety
 */
export function buildSystemPrompt(): string {
  return `You are an expert analyst for a Twitter influencer rating system.

CRITICAL RULES:
1. You MUST NOT invent or assume any data not explicitly provided
2. You MUST NOT say "likely", "probably" without direct evidence
3. If confidence is LOW (<50), you MUST warn about provisional assessment
4. You MUST output valid JSON matching the exact schema provided
5. Be concise, factual, and actionable
6. No marketing fluff - be honest about risks

OUTPUT FORMAT:
- headline: 1 short sentence (max 15 words)
- summary: 3-5 sentences explaining the account
- verdict: STRONG | GOOD | MIXED | RISKY | INSUFFICIENT_DATA
- key_drivers: up to 5 bullet points of strengths
- risks: up to 5 bullet points of concerns (can be empty)
- recommendations: up to 3 actionable suggestions
- evidence: link back to the metrics that support your analysis

VERDICT GUIDE:
- STRONG: Score 800+, high confidence, no red flags
- GOOD: Score 600-799, decent metrics, minor concerns
- MIXED: Score 400-599, or significant gaps in data
- RISKY: Multiple red flags, suspicious patterns, or low quality
- INSUFFICIENT_DATA: Confidence <35 or critical data missing`;
}

/**
 * Build user prompt with structured input
 */
export function buildUserPrompt(input: AiSummaryInput): string {
  const { account_id, mode, snapshot, event } = input;
  
  const modeInstructions = {
    summary: 'Provide an executive summary suitable for deciding whether to work with this account.',
    explain: 'Explain why the score is what it is, what factors drove it up or down.',
    event: 'Generate a short interpretation for a notification/alert about this event.',
  };

  return JSON.stringify({
    task: modeInstructions[mode],
    account_id,
    mode,
    event: event ?? null,
    
    // The ONLY data AI can use
    metrics: {
      score: snapshot.twitter_score_0_1000,
      grade: snapshot.grade,
      confidence: snapshot.twitter_confidence_score_0_100,
      
      components: {
        influence: snapshot.influence_0_1000,
        quality: snapshot.quality_0_1,
        trend: snapshot.trend_0_1,
        network: snapshot.network_0_1,
        consistency: snapshot.consistency_0_1,
      },
      
      audience: {
        quality: snapshot.audience_quality_0_1,
        authority: snapshot.authority_0_1,
        smart_followers: snapshot.smart_followers_0_100,
      },
      
      network: snapshot.hops,
      trends: snapshot.trends,
      early_signal: snapshot.early_signal,
      red_flags: snapshot.red_flags ?? [],
    },
  }, null, 2);
}

/**
 * JSON schema for structured output
 */
export function getOutputSchema(): object {
  return {
    type: 'object',
    properties: {
      headline: { type: 'string', maxLength: 100 },
      summary: { type: 'string', maxLength: 500 },
      verdict: { 
        type: 'string', 
        enum: ['STRONG', 'GOOD', 'MIXED', 'RISKY', 'INSUFFICIENT_DATA'] 
      },
      key_drivers: { 
        type: 'array', 
        items: { type: 'string' },
        maxItems: 7 
      },
      risks: { 
        type: 'array', 
        items: { type: 'string' },
        maxItems: 7 
      },
      recommendations: { 
        type: 'array', 
        items: { type: 'string' },
        maxItems: 7 
      },
      evidence: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          grade: { type: 'string' },
          confidence_0_100: { type: 'number' },
          notable: { type: 'array', items: { type: 'string' } },
        },
        required: ['score'],
      },
      telegram: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['headline', 'summary', 'verdict', 'key_drivers', 'risks', 'recommendations', 'evidence'],
  };
}
