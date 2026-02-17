/**
 * Metrics Job
 * 
 * Периодический сбор метрик каналов
 */
import { TgChannelModel } from '../models/index.js';
import { metricsService } from '../services/index.js';
import { rankingService } from '../services/index.js';

let metricsInterval: NodeJS.Timeout | null = null;
let rankingInterval: NodeJS.Timeout | null = null;

/**
 * Run hourly metrics collection
 */
async function collectHourlyMetrics(): Promise<void> {
  console.log('[Metrics] Collecting hourly metrics...');
  
  const channels = await TgChannelModel.find({ status: 'active' }).lean();
  let processed = 0;
  let errors = 0;

  for (const channel of channels) {
    try {
      await metricsService.calculateHourlyMetrics({ channelId: channel.channelId });
      await metricsService.updateChannelMetrics(channel.channelId);
      processed++;
    } catch (error) {
      console.error(`[Metrics] Error for ${channel.username}:`, error);
      errors++;
    }
  }

  console.log(`[Metrics] Collected: ${processed} success, ${errors} errors`);
}

/**
 * Run daily rankings calculation
 */
async function calculateDailyRankings(): Promise<void> {
  console.log('[Rankings] Calculating daily rankings...');
  
  const result = await rankingService.calculateDailyRankings();
  
  if (result.ok) {
    console.log(`[Rankings] Ranked ${result.ranked} channels`);
  } else {
    console.error('[Rankings] Failed:', result.error);
  }
}

/**
 * Start metrics job (hourly)
 */
export function startMetricsJob(intervalMinutes: number = 60): void {
  if (metricsInterval) {
    console.log('[Metrics] Job already running');
    return;
  }

  console.log(`[Metrics] Starting job (interval: ${intervalMinutes}min)`);
  
  // Run immediately
  collectHourlyMetrics().catch(console.error);
  
  // Then schedule
  metricsInterval = setInterval(
    () => collectHourlyMetrics().catch(console.error),
    intervalMinutes * 60 * 1000
  );
}

/**
 * Stop metrics job
 */
export function stopMetricsJob(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    console.log('[Metrics] Job stopped');
  }
}

/**
 * Start ranking job (daily - runs at midnight)
 */
export function startRankingJob(): void {
  if (rankingInterval) {
    console.log('[Rankings] Job already running');
    return;
  }

  // Calculate time until next midnight
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  console.log(`[Rankings] Starting job (next run in ${Math.round(msUntilMidnight / 60000)}min)`);

  // Run once at midnight, then every 24h
  setTimeout(() => {
    calculateDailyRankings().catch(console.error);
    
    rankingInterval = setInterval(
      () => calculateDailyRankings().catch(console.error),
      24 * 60 * 60 * 1000 // 24 hours
    );
  }, msUntilMidnight);
}

/**
 * Stop ranking job
 */
export function stopRankingJob(): void {
  if (rankingInterval) {
    clearInterval(rankingInterval);
    rankingInterval = null;
    console.log('[Rankings] Job stopped');
  }
}

/**
 * Run metrics collection manually
 */
export async function runMetricsManually(): Promise<{ processed: number }> {
  const channels = await TgChannelModel.find({ status: 'active' }).lean();
  let processed = 0;

  for (const channel of channels) {
    await metricsService.calculateHourlyMetrics({ channelId: channel.channelId });
    processed++;
  }

  return { processed };
}

/**
 * Run rankings calculation manually
 */
export async function runRankingsManually(): Promise<{ ranked: number }> {
  const result = await rankingService.calculateDailyRankings();
  return { ranked: result.ranked };
}
