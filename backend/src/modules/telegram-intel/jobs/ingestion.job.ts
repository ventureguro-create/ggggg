/**
 * Ingestion Job (lock + renew)
 */
import { JobLockService } from './job_lock.service.js';
import { IngestionService } from '../ingestion/ingestion.service.js';
import { TgChannelModel } from '../models_compat/tg.channel.model.js';
import { TgCandidateModel } from '../models_compat/tg.seed.model.js';

export class IngestionJob {
  constructor(
    private lock: JobLockService,
    private svc: IngestionService,
    private log: (msg: string, meta?: any) => void
  ) {}

  async runOnce(params?: { limit?: number }) {
    const acquired = await this.lock.acquire('tg:ingestion', 5 * 60_000);
    if (!acquired) return { ok: true, skipped: true, reason: 'locked' };

    const limit = Math.max(1, Math.min(50, Number(params?.limit || 10)));

    const renewTimer = setInterval(() => {
      this.lock.renew('tg:ingestion', 5 * 60_000).catch(() => {});
    }, 60_000);

    try {
      // Get seeds (approved candidates) + active channels
      const seeds = await TgCandidateModel.find({ status: 'approved' }).select('username').limit(5000).lean();
      const active = await TgChannelModel.find({ status: 'active' }).select('username').limit(5000).lean();

      const set = new Set<string>();
      for (const s of seeds) set.add(String(s.username).toLowerCase());
      for (const a of active) set.add(String(a.username).toLowerCase());

      const list = [...set].slice(0, limit);

      let okCount = 0;
      let inserted = 0;

      for (const u of list) {
        try {
          const res: any = await this.svc.ingestChannel(u);
          okCount += 1;
          inserted += Number(res?.inserted || 0);
        } catch {}
      }

      this.log('[tg] ingestion job done', { processed: list.length, okCount, inserted });
      return { ok: true, processed: list.length, okCount, inserted };
    } finally {
      clearInterval(renewTimer);
      await this.lock.release('tg:ingestion');
    }
  }
}
