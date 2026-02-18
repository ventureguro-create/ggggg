/**
 * Track Record Service
 * Computes historical performance stats for channels
 * Phase 3 Step 3 v2
 */
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';
import { TgChannelTrackRecordModel } from '../models/tg.channel_track_record.model.js';

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base] || 0;
}

export class TrackRecordService {
  constructor(private log: (msg: string, meta?: any) => void) {}

  async compute(username: string, days = 90) {
    const u = username.toLowerCase();
    const since = new Date(Date.now() - days * 86400000);

    const mentions = await TgTokenMentionModel.find({
      username: u,
      mentionedAt: { $gte: since },
    })
      .select('mentionedAt evaluated returns')
      .lean();

    const totalMentions = mentions.length;
    const evaluated = mentions.filter((m: any) => m.evaluated && m.returns?.r7d != null);
    const evaluatedMentions = evaluated.length;

    if (evaluatedMentions < 3) {
      return null;
    }

    const r7d = evaluated.map((m: any) => Number(m.returns?.r7d ?? 0));
    const r24h = evaluated.map((m: any) => Number(m.returns?.r24h ?? 0));

    const avgReturn7d = r7d.reduce((a, b) => a + b, 0) / r7d.length;
    const avgReturn24h = r24h.reduce((a, b) => a + b, 0) / r24h.length;
    const returnStd7d = std(r7d);
    const returnStd24h = std(r24h);

    const bestReturn7d = Math.max(...r7d);
    const worstReturn7d = Math.min(...r7d);

    // Consistency: 1 / (1 + CV), where CV = std/|mean|
    const cv = avgReturn7d !== 0 ? Math.abs(returnStd7d / avgReturn7d) : 10;
    const consistency = Math.max(0, Math.min(1, 1 - cv / 10));

    const q25Return7d = quantile(r7d, 0.25);
    const q50Return7d = quantile(r7d, 0.5);
    const q75Return7d = quantile(r7d, 0.75);

    const mentionsPerWeek = totalMentions / (days / 7);

    const doc = {
      username: u,
      totalMentions,
      evaluatedMentions,
      mentionsPerWeek,
      avgReturn7d,
      avgReturn24h,
      returnStd7d,
      returnStd24h,
      bestReturn7d,
      worstReturn7d,
      consistency,
      q25Return7d,
      q50Return7d,
      q75Return7d,
      computedAt: new Date(),
      windowDays: days,
    };

    await TgChannelTrackRecordModel.updateOne(
      { username: u },
      { $set: doc },
      { upsert: true }
    );

    this.log('[track-record] computed', { username: u, evaluatedMentions, avgReturn7d: avgReturn7d.toFixed(2) });

    return doc;
  }
}
