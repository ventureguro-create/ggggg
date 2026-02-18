/**
 * Temporal Trend Service
 * Compute top movers (biggest score changes)
 */
import { TgScoreSnapshotModel } from '../models/tg.score_snapshot.model.js';

const ALLOWED_METRICS = new Set([
  'intelScore',
  'alphaScore',
  'credibilityScore',
  'networkAlphaScore',
  'fraudRisk',
]);

function clampMetric(metric: string): string {
  return ALLOWED_METRICS.has(metric) ? metric : 'intelScore';
}

export class TemporalTrendService {
  async topMovers(days = 7, metric = 'intelScore', limit = 50) {
    const m = clampMetric(metric);
    const today = new Date();
    const dayTo = today.toISOString().slice(0, 10);
    const dayFrom = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);

    // Pull snapshots for range
    const snaps = await TgScoreSnapshotModel.find({
      day: { $gte: dayFrom, $lte: dayTo },
    }).lean();

    const byUser = new Map<string, any[]>();
    for (const s of snaps) {
      if (!byUser.has((s as any).username)) byUser.set((s as any).username, []);
      byUser.get((s as any).username)!.push(s);
    }

    const deltas: any[] = [];
    for (const [u, arr] of byUser) {
      arr.sort((a, b) => a.day.localeCompare(b.day));
      const first = arr[0];
      const last = arr[arr.length - 1];

      const v0 = Number(first?.scores?.[m] ?? 0);
      const v1 = Number(last?.scores?.[m] ?? 0);

      deltas.push({
        username: u,
        metric: m,
        from: { day: first.day, value: v0 },
        to: { day: last.day, value: v1 },
        delta: v1 - v0,
      });
    }

    deltas.sort((a, b) => b.delta - a.delta);

    return {
      ok: true,
      metric: m,
      days,
      count: Math.min(limit, deltas.length),
      items: deltas.slice(0, limit),
    };
  }

  async getChannelHistory(username: string, days = 90) {
    const u = username.toLowerCase();
    const dayFrom = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);

    const items = await TgScoreSnapshotModel.find({
      username: u,
      day: { $gte: dayFrom },
    })
      .sort({ day: 1 })
      .lean();

    return { ok: items.length > 0, username: u, days, count: items.length, items };
  }
}
