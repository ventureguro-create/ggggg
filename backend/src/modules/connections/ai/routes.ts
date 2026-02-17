/**
 * AI Summary Routes (Phase 3.5)
 * Public API endpoints
 */

import type { FastifyInstance } from 'fastify';
import { AiSummaryInputSchema, type AiSummaryInput } from './contracts.js';
import { AiSummaryService } from './service.js';

let aiService: AiSummaryService | null = null;

export function setAiService(service: AiSummaryService) {
  aiService = service;
}

export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * POST /summary
   * Generate AI summary for an account
   */
  app.post('/summary', async (request, reply) => {
    if (!aiService) {
      return reply.status(503).send({ ok: false, error: 'AI service not initialized' });
    }
    
    try {
      const input = AiSummaryInputSchema.parse(request.body);
      const result = await aiService.summarize(input);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[AI Routes] Summary error:', err);
      return reply.status(400).send({
        ok: false,
        error: err.message || 'Invalid input',
      });
    }
  });
  
  /**
   * POST /summary/batch
   * Generate AI summaries for multiple accounts
   */
  app.post('/summary/batch', async (request, reply) => {
    if (!aiService) {
      return reply.status(503).send({ ok: false, error: 'AI service not initialized' });
    }
    
    try {
      const inputs = Array.isArray(request.body) ? request.body : [];
      const results = await aiService.summarizeBatch(inputs);
      
      return reply.send({
        ok: true,
        data: { items: results, count: results.length },
      });
    } catch (err: any) {
      console.error('[AI Routes] Batch error:', err);
      return reply.status(400).send({
        ok: false,
        error: err.message || 'Batch processing failed',
      });
    }
  });
  
  /**
   * GET /summary/mock
   * Get mock AI summary for testing
   */
  app.get('/summary/mock', async (_request, reply) => {
    return reply.send({
      ok: true,
      data: {
        version: '3.5.0',
        model: 'mock',
        language: 'en',
        headline: 'Strong influencer with high-quality network connections',
        summary: 'This account demonstrates strong influence within a high-quality network. The audience appears organic with good engagement patterns. Connected to multiple authority accounts within 2 hops. Recent growth shows healthy acceleration without suspicious spikes.',
        verdict: 'STRONG',
        key_drivers: [
          'High smart followers ratio (84/100)',
          'Strong network proximity to elite accounts (avg 1.8 hops)',
          'Consistent growth trajectory',
          'High audience quality score (0.86)',
          'No red flags detected',
        ],
        risks: [
          'Growth rate slightly slowing in recent period',
        ],
        recommendations: [
          'Strong candidate for early-stage campaign seeding',
          'Consider for long-term partnership given stable metrics',
          'Monitor velocity trends over next 7 days',
        ],
        evidence: {
          score: 842,
          grade: 'A',
          confidence_0_100: 87,
          notable: [
            'Smart followers: 84/100',
            '2 hops to @crypto_whale',
            'Breakout signal active',
          ],
        },
        telegram: {
          title: 'Strong Influencer Identified',
          text: 'High-quality account with elite network connections. Score: 842 (A). Recommended for campaign consideration.',
          tags: ['strong', 'breakout', 'high-quality'],
        },
      },
    });
  });
  
  /**
   * GET /info
   * Get AI service info
   */
  app.get('/info', async (_request, reply) => {
    return reply.send({
      ok: true,
      data: {
        version: '3.5.0',
        provider: 'openai',
        mode: 'structured_output',
        features: ['summary', 'explain', 'event'],
        ready: aiService !== null,
      },
    });
  });
  
  /**
   * GET /cached/:accountId
   * Get cached AI summary for account
   */
  app.get('/cached/:accountId', async (request, reply) => {
    if (!aiService) {
      return reply.status(503).send({ ok: false, error: 'AI service not initialized' });
    }
    
    const { accountId } = request.params as { accountId: string };
    const cached = await aiService.getCached(accountId);
    
    if (!cached) {
      return reply.status(404).send({ ok: false, error: 'No cached summary found' });
    }
    
    return reply.send({
      ok: true,
      data: cached,
      cached: true,
    });
  });
  
  console.log('[AI Routes] Registered at /api/connections/ai/*');
}
