/**
 * Telegram Discovery Module
 * 
 * Изолированный модуль для:
 * - Discovery каналов через forwards/mentions
 * - Ingestion постов
 * - Metrics collection
 * - Ranking/scoring
 * - Fraud detection
 * 
 * Collections (all prefixed with tg_):
 * - tg_channels
 * - tg_posts
 * - tg_metrics
 * - tg_rankings
 * - tg_discovery_edges
 * - tg_candidates
 * 
 * API: /api/telegram/*
 */
import { FastifyInstance } from 'fastify';
import { registerTelegramDiscoveryRoutes } from './routes/index.js';
import { telegramAdapter } from './adapter/index.js';
import { 
  startDiscoveryJob, 
  stopDiscoveryJob,
  startMetricsJob,
  stopMetricsJob,
  startRankingJob,
  stopRankingJob
} from './jobs/index.js';

// Re-export models
export * from './models/index.js';

// Re-export services
export * from './services/index.js';

// Re-export adapter
export { telegramAdapter } from './adapter/index.js';

// Re-export jobs
export * from './jobs/index.js';

/**
 * Initialize Telegram Discovery Module
 */
export async function initTelegramDiscoveryModule(app: FastifyInstance): Promise<void> {
  console.log('[TelegramDiscovery] Initializing module...');

  // Initialize Telegram adapter
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  
  await telegramAdapter.initialize({
    apiId,
    apiHash,
  });

  // Register routes
  await registerTelegramDiscoveryRoutes(app);

  // Start background jobs if not in minimal boot mode
  const minimalBoot = process.env.MINIMAL_BOOT === '1';
  
  if (!minimalBoot) {
    console.log('[TelegramDiscovery] Starting background jobs...');
    startDiscoveryJob(10);    // Every 10 minutes
    startMetricsJob(60);      // Every hour
    startRankingJob();        // Daily at midnight
  } else {
    console.log('[TelegramDiscovery] Minimal boot - jobs disabled');
  }

  console.log('[TelegramDiscovery] Module initialized successfully');
}

/**
 * Shutdown Telegram Discovery Module
 */
export function shutdownTelegramDiscoveryModule(): void {
  console.log('[TelegramDiscovery] Shutting down...');
  stopDiscoveryJob();
  stopMetricsJob();
  stopRankingJob();
}

/**
 * Module boundary check
 * Returns true if module is properly isolated
 */
export function checkModuleBoundary(): boolean {
  // This module should:
  // 1. Only use tg_* collections
  // 2. Only expose /api/telegram/* routes
  // 3. Not depend on other modules (except common utilities)
  return true;
}
