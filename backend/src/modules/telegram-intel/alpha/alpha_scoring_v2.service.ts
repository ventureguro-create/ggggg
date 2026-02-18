/**
 * Alpha Scoring Service v2 - Institutional Grade
 * Phase 3 Step 3 v2
 *
 * Formula:
 * alphaScore = 100 ×
 *   (0.30 × BayesianSuccess7d +
 *    0.20 × RiskAdjustedReturn +
 *    0.15 × Earlyness +
 *    0.15 × Stability +
 *    0.10 × Hit24h +
 *    0.10 × Consistency)
 *   × SampleConfidence
 *   × (1 − Penalty)
 */
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';
import { TgAlphaScoreModel } from '../models/tg.alpha_score.model.js';
import { TrackRecordService } from './track_record.service.js';

// Bayesian posterior mean: (prior_mean * prior_strength + successes) / (prior_strength + total)
function bayesRate(success: number, total: number, priorMean = 0.18, priorStrength = 16): number {
  const a = priorMean * priorStrength + success;
  const b = (1 - priorMean) * priorStrength + (total - success);
  return a / (a + b);
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp100(x: number): number {
  return Math.max(0, Math.min(100, x));
}

const MIN_MENTIONS = 8;

export class AlphaScoringServiceV2 {
  private tr: TrackRecordService;

  constructor(private log: (msg: string, meta?: any) => void) {
    this.tr = new TrackRecordService(log);
  }

  /**
   * Compute institutional alpha score for channel
   */
  async compute(username: string, days = 90) {
    const u = username.toLowerCase();
    const since = new Date(Date.now() - days * 86400000);

    const mentions = await TgTokenMentionModel.find({
      username: u,
      evaluated: true,
      mentionedAt: { $gte: since },
    })
      .select('returns')
      .lean();

    const n = mentions.length;

    if (n < MIN_MENTIONS) {
      return this.storeLowSample(u, n);
    }

    const r24 = mentions.map((m: any) => Number(m.returns?.r24h ?? 0));
    const r7 = mentions.map((m: any) => Number(m.returns?.r7d ?? 0));

    const succ7 = r7.filter((x) => x >= 10).length;
    const succ24 = r24.filter((x) => x >= 5).length;

    // Bayesian hit rates
    const hit7 = bayesRate(succ7, r7.length, 0.18, 16);
    const hit24 = bayesRate(succ24, r24.length, 0.22, 14);

    const avg7 = r7.reduce((a, b) => a + b, 0) / r7.length;
    const std7 = std(r7);

    // Risk Adjusted Return (Sharpe-lite)
    const rar = avg7 / (1 + std7);
    const rarScore = sigmoid(rar / 12);

    // Earlyness approximation: if r24h > r7d/3 → likely early
    const avg24 = r24.reduce((a, b) => a + b, 0) / r24.length;
    const earlyness = sigmoid((avg24 - avg7 / 3) / 10);

    // Stability
    const stability = 1 / (1 + std7 / 25);

    // Track record for consistency
    const track = await this.tr.compute(u, days);
    const consistency = track?.consistency ?? 0;

    // Spam penalty
    const mpw = track?.mentionsPerWeek ?? n / (days / 7);
    const spamPenalty = clamp01((mpw - 20) / 40);

    // Drawdown penalty
    const worst7 = track?.worstReturn7d ?? -999;
    const drawdownPenalty = clamp01((-worst7 - 35) / 70);

    // Sample confidence: sqrt(n/60)
    const sampleConfidence = clamp01(Math.sqrt(n / 60));

    // Base score (weighted components)
    const base =
      0.30 * hit7 +
      0.20 * rarScore +
      0.15 * earlyness +
      0.15 * stability +
      0.10 * hit24 +
      0.10 * consistency;

    // Combined penalty
    const penalty = 0.6 * spamPenalty + 0.4 * drawdownPenalty;

    // Final alpha (0..1)
    const alpha01 = clamp01(base * (1 - penalty) * sampleConfidence);
    const alphaScore = clamp100(alpha01 * 100);

    const breakdown = {
      n,
      hit7,
      hit24,
      avg7,
      std7,
      rar,
      rarScore,
      earlyness,
      stability,
      consistency,
      mentionsPerWeek: mpw,
      spamPenalty,
      drawdownPenalty,
      sampleConfidence,
      base,
      penalty,
      alpha01,
      reason: 'computed',
    };

    await TgAlphaScoreModel.updateOne(
      { username: u },
      {
        $set: {
          username: u,
          alphaScore,
          credibilityScore: 0,
          sampleSize: n,
          evaluatedMentions: n,
          breakdown,
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );

    this.log('[alpha-v2] computed', {
      username: u,
      alphaScore: alphaScore.toFixed(1),
      hit7: (hit7 * 100).toFixed(1) + '%',
      n,
    });

    return { username: u, alphaScore, breakdown };
  }

  /**
   * Store low sample result
   */
  private async storeLowSample(username: string, n: number) {
    const breakdown = {
      n,
      reason: 'low_sample',
    };

    await TgAlphaScoreModel.updateOne(
      { username },
      {
        $set: {
          username,
          alphaScore: 0,
          credibilityScore: 0,
          sampleSize: n,
          evaluatedMentions: n,
          breakdown,
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return { username, alphaScore: 0, breakdown };
  }

  /**
   * Batch compute for all channels with sufficient data
   */
  async computeBatch(limit = 50, days = 90) {
    const channels = await TgTokenMentionModel.aggregate([
      {
        $match: {
          evaluated: true,
          mentionedAt: { $gte: new Date(Date.now() - days * 86400000) },
        },
      },
      { $group: { _id: '$username', count: { $sum: 1 } } },
      { $match: { count: { $gte: MIN_MENTIONS } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    let computed = 0;
    let skipped = 0;

    for (const ch of channels) {
      const result = await this.compute(ch._id, days);
      if (result.alphaScore > 0) {
        computed++;
      } else {
        skipped++;
      }
    }

    return { ok: true, processed: channels.length, computed, skipped };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 20) {
    const items = await TgAlphaScoreModel.find({
      sampleSize: { $gte: MIN_MENTIONS },
      alphaScore: { $gt: 0 },
    })
      .sort({ alphaScore: -1 })
      .limit(limit)
      .select('-_id -__v')
      .lean();

    return { ok: true, items };
  }

  /**
   * Get channel score
   */
  async getChannelScore(username: string) {
    const u = username.toLowerCase();
    const doc = await TgAlphaScoreModel.findOne({ username: u }).select('-_id -__v').lean();
    return { ok: !!doc, doc };
  }

  /**
   * Get stats
   */
  async getStats() {
    const stats = await TgAlphaScoreModel.aggregate([
      { $match: { sampleSize: { $gte: MIN_MENTIONS } } },
      {
        $group: {
          _id: null,
          totalChannels: { $sum: 1 },
          avgAlphaScore: { $avg: '$alphaScore' },
          topScore: { $max: '$alphaScore' },
        },
      },
    ]);

    return stats[0] || { totalChannels: 0, avgAlphaScore: 0, topScore: 0 };
  }
}
