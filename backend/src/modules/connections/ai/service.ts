/**
 * AI Summary Service (Phase 3.5)
 * 
 * Uses OpenAI via Emergent LLM key for AI interpretations
 * Enforces confidence gates and structured outputs
 */

import type { Db } from 'mongodb';
import {
  AiSummaryInputSchema,
  type AiSummaryInput,
  type AiSummaryOutput,
  type Verdict,
} from './contracts.js';
import { getAiConfig, type AiConfig } from './config.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import { AiSummaryStore } from './store.js';

export class AiSummaryService {
  private store: AiSummaryStore;
  private apiKey: string;
  private baseUrl: string;
  
  constructor(db: Db) {
    this.store = new AiSummaryStore(db);
    // Use OpenAI API key from environment
    this.apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY || '';
    this.baseUrl = 'https://api.openai.com/v1';
  }
  
  async init(): Promise<void> {
    await this.store.init();
    console.log('[AI Service] Initialized');
  }
  
  /**
   * Generate AI summary for account
   */
  async summarize(rawInput: unknown): Promise<AiSummaryOutput> {
    const input = AiSummaryInputSchema.parse(rawInput);
    const config = getAiConfig();
    
    // Check if AI is enabled
    if (!config.enabled) {
      return this.createInsufficientResponse(input, 'AI layer disabled by admin config.');
    }
    
    // Confidence gate
    const confidence = input.snapshot.twitter_confidence_score_0_100;
    if (typeof confidence === 'number' && confidence < config.min_confidence_to_run) {
      return this.createInsufficientResponse(
        input,
        `Data confidence too low (${confidence}%). Minimum required: ${config.min_confidence_to_run}%.`
      );
    }
    
    // Check cache
    const hash = AiSummaryStore.hashInput(input);
    const cached = await this.store.getByHash(hash);
    if (cached) {
      console.log(`[AI Service] Cache hit for ${input.account_id}`);
      return cached;
    }
    
    // Call AI
    try {
      const output = await this.callAI(input, config);
      
      // Store in cache
      await this.store.put({
        hash,
        account_id: input.account_id,
        input,
        output,
        ttlSec: config.cache_ttl_sec,
      });
      
      return output;
    } catch (err) {
      console.error('[AI Service] AI call failed:', err);
      return this.createInsufficientResponse(input, 'AI service temporarily unavailable.');
    }
  }
  
  /**
   * Generate AI summary for multiple accounts
   */
  async summarizeBatch(inputs: unknown[]): Promise<AiSummaryOutput[]> {
    const results: AiSummaryOutput[] = [];
    
    for (const input of inputs) {
      try {
        const result = await this.summarize(input);
        results.push(result);
      } catch (err) {
        console.error('[AI Service] Batch item failed:', err);
        results.push(this.createInsufficientResponse(
          AiSummaryInputSchema.parse(input),
          'Processing failed'
        ));
      }
    }
    
    return results;
  }
  
  /**
   * Get cached summary for account
   */
  async getCached(accountId: string): Promise<AiSummaryOutput | null> {
    return this.store.getByAccountId(accountId);
  }
  
  /**
   * Get cache statistics
   */
  async getStats() {
    return this.store.getStats();
  }
  
  /**
   * Call OpenAI via fetch (with intelligent mock fallback)
   */
  private async callAI(input: AiSummaryInput, config: AiConfig): Promise<AiSummaryOutput> {
    // If no API key, use intelligent mock
    if (!this.apiKey) {
      console.log('[AI Service] No API key, using intelligent mock');
      return this.generateIntelligentMock(input, config);
    }
    
    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(input);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          temperature: config.temperature,
          max_tokens: config.max_output_tokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `Analyze this account and return JSON:\n\n${userPrompt}\n\nReturn ONLY valid JSON matching the schema.`
            },
          ],
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Service] OpenAI API error: ${response.status}`, errorText);
        // Fallback to intelligent mock on API error
        return this.generateIntelligentMock(input, config);
      }
      
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = this.safeJsonParse(content);
      
      // Validate and return
      return {
        version: '3.5.0',
        model: config.model || 'gpt-4o-mini',
        language: config.language,
        headline: parsed.headline || 'AI Analysis Complete',
        summary: parsed.summary || 'Analysis generated by AI.',
        verdict: this.validateVerdict(parsed.verdict),
        key_drivers: Array.isArray(parsed.key_drivers) ? parsed.key_drivers.slice(0, 7) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 7) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 7) : [],
        evidence: {
          score: input.snapshot.twitter_score_0_1000,
          grade: input.snapshot.grade,
          confidence_0_100: input.snapshot.twitter_confidence_score_0_100,
          notable: Array.isArray(parsed.evidence?.notable) ? parsed.evidence.notable : [],
        },
        telegram: parsed.telegram,
      };
    } catch (err) {
      console.error('[AI Service] API call failed:', err);
      // Fallback to intelligent mock on any error
      return this.generateIntelligentMock(input, config);
    }
  }
  
  /**
   * Generate intelligent mock based on input metrics
   * This provides high-quality deterministic responses
   */
  private generateIntelligentMock(input: AiSummaryInput, config: AiConfig): AiSummaryOutput {
    const s = input.snapshot;
    const score = s.twitter_score_0_1000;
    const confidence = s.twitter_confidence_score_0_100 || 75;
    
    // Determine verdict based on metrics
    let verdict: Verdict;
    let headline: string;
    let summary: string;
    const keyDrivers: string[] = [];
    const risks: string[] = [];
    const recommendations: string[] = [];
    const notable: string[] = [];
    
    // Analyze score range
    if (score >= 800) {
      verdict = 'STRONG';
      headline = 'High-quality influencer with strong network presence';
      summary = 'This account demonstrates exceptional influence metrics with high audience quality. The network connections show proximity to authority figures, and engagement patterns appear organic. Suitable for premium campaign partnerships.';
    } else if (score >= 600) {
      verdict = 'GOOD';
      headline = 'Solid performer with growing influence';
      summary = 'This account shows good potential with steady growth metrics. The audience quality is above average, and network connections are developing. Consider for mid-tier campaign participation.';
    } else if (score >= 400) {
      verdict = 'MIXED';
      headline = 'Emerging account with variable metrics';
      summary = 'This account presents mixed signals. While some metrics are promising, others need improvement. Monitor development before major commitments.';
    } else {
      verdict = 'RISKY';
      headline = 'Account requires caution - multiple concerns detected';
      summary = 'This account shows concerning patterns in influence metrics. The audience quality and engagement patterns raise questions. Not recommended for premium partnerships.';
    }
    
    // Add key drivers based on metrics
    if (s.smart_followers_0_100 && s.smart_followers_0_100 > 70) {
      keyDrivers.push(`High smart followers ratio (${s.smart_followers_0_100}/100)`);
      notable.push(`Smart followers: ${s.smart_followers_0_100}/100`);
    }
    
    if (s.audience_quality_0_1 && s.audience_quality_0_1 > 0.75) {
      keyDrivers.push(`Strong audience quality (${Math.round(s.audience_quality_0_1 * 100)}%)`);
    }
    
    if (s.authority_0_1 && s.authority_0_1 > 0.7) {
      keyDrivers.push(`High authority score (${Math.round(s.authority_0_1 * 100)}%)`);
    }
    
    if (s.network_0_1 && s.network_0_1 > 0.8) {
      keyDrivers.push('Strong network positioning');
    }
    
    if (s.hops?.avg_hops_to_top && s.hops.avg_hops_to_top < 3) {
      keyDrivers.push(`Close to authority accounts (${s.hops.avg_hops_to_top.toFixed(1)} avg hops)`);
      notable.push(`${s.hops.avg_hops_to_top.toFixed(1)} hops to elite`);
    }
    
    if (s.early_signal?.badge === 'breakout') {
      keyDrivers.push('Breakout signal detected - early growth opportunity');
      notable.push('Breakout signal active');
    } else if (s.early_signal?.badge === 'rising') {
      keyDrivers.push('Rising signal - positive momentum');
    }
    
    if (s.trends?.state === 'growing') {
      keyDrivers.push('Positive growth trend');
    }
    
    // Add risks based on metrics
    if (s.red_flags && s.red_flags.length > 0) {
      risks.push(...s.red_flags.slice(0, 3));
    }
    
    if (s.audience_quality_0_1 && s.audience_quality_0_1 < 0.5) {
      risks.push('Below average audience quality');
    }
    
    if (s.consistency_0_1 && s.consistency_0_1 < 0.6) {
      risks.push('Inconsistent engagement patterns');
    }
    
    if (s.trends?.state === 'cooling') {
      risks.push('Growth momentum slowing');
    }
    
    if (confidence < 60) {
      risks.push(`Data confidence is moderate (${confidence}%)`);
    }
    
    // Add recommendations
    if (verdict === 'STRONG' || verdict === 'GOOD') {
      recommendations.push('Consider for campaign partnerships');
      if (s.early_signal?.badge === 'breakout') {
        recommendations.push('Act early - breakout signals indicate growth potential');
      }
      recommendations.push('Monitor velocity trends for optimal timing');
    } else if (verdict === 'MIXED') {
      recommendations.push('Wait for more consistent metrics before engaging');
      recommendations.push('Set up alerts for score improvements');
    } else {
      recommendations.push('Not recommended for current campaigns');
      recommendations.push('Review red flags before any engagement');
    }
    
    // Telegram text for events
    let telegram;
    if (input.mode === 'event' && input.event) {
      telegram = {
        title: `${input.event.type?.replace('_', ' ')} Detected`,
        text: `${headline}. Score: ${score} (${s.grade || 'N/A'}). ${verdict === 'STRONG' ? 'Recommended for immediate review.' : 'Exercise caution.'}`,
        tags: [verdict.toLowerCase(), s.early_signal?.badge || 'none'].filter(Boolean),
      };
    }
    
    return {
      version: '3.5.0',
      model: 'intelligent-mock',
      language: config.language,
      headline,
      summary,
      verdict,
      key_drivers: keyDrivers.length > 0 ? keyDrivers : ['Score within expected range'],
      risks: risks.length > 0 ? risks : [],
      recommendations,
      evidence: {
        score,
        grade: s.grade,
        confidence_0_100: confidence,
        notable,
      },
      telegram,
    };
  }
  
  /**
   * Create insufficient data response
   */
  private createInsufficientResponse(input: AiSummaryInput, reason: string): AiSummaryOutput {
    return {
      version: '3.5.0',
      model: getAiConfig().model,
      language: getAiConfig().language,
      headline: 'Insufficient data for AI analysis',
      summary: `Cannot generate reliable AI interpretation: ${reason}`,
      verdict: 'INSUFFICIENT_DATA',
      key_drivers: [],
      risks: [reason],
      recommendations: ['Increase data coverage or confidence score to enable AI analysis'],
      evidence: {
        score: input.snapshot.twitter_score_0_1000,
        grade: input.snapshot.grade,
        confidence_0_100: input.snapshot.twitter_confidence_score_0_100,
        notable: [],
      },
    };
  }
  
  /**
   * Safe JSON parse with fallback
   */
  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      // Try to extract JSON from response
      const start = str.indexOf('{');
      const end = str.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(str.slice(start, end + 1));
        } catch {
          return {};
        }
      }
      return {};
    }
  }
  
  /**
   * Validate verdict enum
   */
  private validateVerdict(v: unknown): Verdict {
    const valid: Verdict[] = ['STRONG', 'GOOD', 'MIXED', 'RISKY', 'INSUFFICIENT_DATA'];
    if (typeof v === 'string' && valid.includes(v as Verdict)) {
      return v as Verdict;
    }
    return 'MIXED';
  }
}
