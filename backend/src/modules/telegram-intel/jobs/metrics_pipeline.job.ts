/**
 * Metrics Pipeline Job
 * 
 * Nightly pipeline: ingestion → metrics → fraud → ranking
 */
import { TgChannelModel } from '../models_compat/tg.channel.model.js';
import { WindowMetricsService } from '../metrics/window_metrics.service.js';
import { FraudSnapshotService } from '../fraud/fraud_snapshot.service.js';
import { RankingSnapshotService } from '../ranking/ranking_snapshot.service.js';
import { JobLockService } from './job_lock.service.js';

export class MetricsPipelineJob {
  private metricsService = new WindowMetricsService();
  private fraudService = new FraudSnapshotService();
  private rankingService = new RankingSnapshotService();
  private lockService = new JobLockService();

  constructor(private log: (msg: string, meta?: any) => void) {}

  async run(): Promise<{ processed: number; errors: number }> {
    const acquired = await this.lockService.acquire('tg:metrics_pipeline', 30 * 60_000);
    if (!acquired) {
      this.log('[tg] metrics pipeline skipped - locked');
      return { processed: 0, errors: 0 };
    }

    const renewTimer = setInterval(() => {
      this.lockService.renew('tg:metrics_pipeline', 30 * 60_000).catch(() => {});
    }, 5 * 60_000);

    try {
      const channels = await TgChannelModel.find({ status: 'active' })
        .select('username')
        .lean();

      let processed = 0;
      let errors = 0;

      for (const ch of channels) {
        try {
          // 1. Compute window metrics (7d, 30d, 90d)
          await this.metricsService.computeAll(ch.username);

          // 2. Compute fraud signals
          await this.fraudService.compute(ch.username);

          // 3. Compute ranking score
          await this.rankingService.compute(ch.username);

          processed++;
        } catch (e: any) {
          errors++;
          this.log('[tg] pipeline error', { username: ch.username, err: String(e?.message || e) });
        }
      }

      // 4. Assign ranks
      const ranked = await this.rankingService.assignRanks();

      this.log('[tg] metrics pipeline completed', { processed, errors, ranked });

      return { processed, errors };
    } finally {
      clearInterval(renewTimer);
      await this.lockService.release('tg:metrics_pipeline');
    }
  }

  /**
   * Run for a single channel (for testing/debugging)
   */
  async runSingle(username: string): Promise<{
    metrics: boolean;
    fraud: number;
    score: number | null;
  }> {
    await this.metricsService.computeAll(username);
    const fraud = await this.fraudService.compute(username);
    const score = await this.rankingService.compute(username);

    return { metrics: true, fraud, score };
  }
}
