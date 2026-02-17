/**
 * Sentiment Module Index
 */

import { FastifyInstance } from 'fastify';
import { registerSentimentRoutes } from './sentiment.routes.js';
import { registerSentimentAdminRoutes } from './sentiment.admin.routes.js';
import { registerTwitterRuntimeRoutes } from './twitter-runtime.routes.js';
import { registerSentimentAutomationRoutes } from './sentiment-automation.routes.js';

export async function initSentimentModule(app: FastifyInstance) {
  const enabled = process.env.SENTIMENT_ENABLED === 'true';
  
  if (!enabled) {
    console.log('[Sentiment] Module disabled (SENTIMENT_ENABLED != true)');
    return;
  }

  console.log('[Sentiment] Initializing module...');
  
  // Register routes
  registerSentimentRoutes(app);
  registerSentimentAdminRoutes(app);
  
  // Phase 10.8: Twitter Runtime Validation
  registerTwitterRuntimeRoutes(app);
  console.log('[Sentiment] Twitter Runtime routes registered (10.8)');
  
  // Phase S4.1: Twitter Sentiment Automation
  registerSentimentAutomationRoutes(app);
  console.log('[Sentiment] Automation routes registered (S4.1)');
  
  console.log('[Sentiment] Module initialized ✓');
}

export { sentimentClient } from './sentiment.client.js';
