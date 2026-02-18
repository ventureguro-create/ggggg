/**
 * Credibility Service
 * Phase 3 Step 4: Institutional reliability scoring
 *
 * Answers: "How much can we trust this channel as a signal source,
 * given history, risk, recency, and stability?"
 *
 * credibility ≠ alpha
 * Alpha = "can catch growth", Credibility = "how stable and predictable"
 */
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';
import { TgAlphaScoreModel } from '../models/tg.alpha_score.model.js';
import { TgCredibilityModel } from '../models/tg.credibility.model.js';
import { TgChannelTrackRecordModel } from '../models/tg.channel_track_record.model.js';
import { expDecayWeight } from './decay.js';
import { betaPosterior, betaCI, clamp01, clamp100 } from './stats.js';

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function tierFromScore(score: number): string {
  if (score >= 90) return 'AAA';
  if (score >= 82) return 'AA';
  if (score >= 74) return 'A';
  if (score >= 66) return 'BBB';
  if (score >= 58) return 'BB';
  if (score >= 50) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export class CredibilityService {
  constructor(private log: (msg: string, meta?: any) => void) {}

  async compute(username: string, opts?: { halfLifeDays?: number }) {
    const u = username.toLowerCase();
    const halfLifeDays = Number(opts?.halfLifeDays || 21);

    // Load last alpha score
    const alphaDoc = await TgAlphaScoreModel.findOne({ username: u }).lean();
    const alpha90 = Number((alphaDoc as any)?.alphaScore || 0);

    // Trend: compute alpha on 30d window (quick estimate)
    const alpha30 = await this.computeAlphaQuick(u, 30);

    const trendDir =
      alpha30 > alpha90 + 6
        ? 'improving'
        : alpha30 < alpha90 - 6
        ? 'deteriorating'
        : 'flat';

    // Track record stats
    const tr = await TgChannelTrackRecordModel.findOne({ username: u }).lean();
    const std7d = Number((tr as any)?.returnStd7d || 0);
    const drawdown = Number((tr as any)?.worstReturn7d || 0);
    const consistency = Number((tr as any)?.consistency || 0);
    const mentionsPerWeek = Number((tr as any)?.mentionsPerWeek || 0);

    const spamPenalty = clamp01((mentionsPerWeek - 20) / 40);
    const drawdownPenalty = clamp01((-drawdown - 35) / 70);
    const stabilityScore = clamp01((1 / (1 + std7d / 22)) * 0.6 + consistency * 0.4);

    // Build weighted hit rate posterior using recency decay
    const since = new Date(Date.now() - 120 * 86400000); // lookback 120d
    const mentions = await TgTokenMentionModel.find({
      username: u,
      evaluated: true,
      mentionedAt: { $gte: since },
    })
      .select('mentionedAt returns')
      .lean();

    let wTotal = 0;
    let wSuccess = 0;

    for (const m of mentions) {
      const ageDays =
        (Date.now() - new Date((m as any).mentionedAt).getTime()) / 86400000;
      const w = expDecayWeight(ageDays, halfLifeDays);
      wTotal += w;

      const r7 = Number((m as any).returns?.r7d ?? 0);
      if (r7 >= 10) wSuccess += w;
    }

    // Posterior: treat weights as fractional counts
    const post = betaPosterior(wSuccess, Math.max(1e-6, wTotal), 0.18, 16);
    const ci = betaCI(post.a, post.b);

    // Recency-adjusted alpha = alpha90 × (0.6 + 0.4 × weightedSampleFactor)
    const weightedSampleFactor = clamp01(Math.sqrt(wTotal / 40));
    const recencyAdjustedAlpha = alpha90 * (0.6 + 0.4 * weightedSampleFactor);

    // Credibility core components
    const hitReliability = clamp01((post.mean - 0.12) / 0.25);
    const ciWidth = ci.high - ci.low;
    const certainty = clamp01(1 - ciWidth / 0.5);

    const alphaSignal = clamp01(recencyAdjustedAlpha / 100);
    const riskPenalty = clamp01(0.55 * spamPenalty + 0.45 * drawdownPenalty);

    // Final credibility (0..1)
    const cred01 =
      (0.30 * hitReliability +
        0.25 * certainty +
        0.25 * alphaSignal +
        0.20 * stabilityScore) *
      (1 - 0.55 * riskPenalty);

    const credibilityScore = clamp100(cred01 * 100);
    const tier = tierFromScore(credibilityScore);

    const doc = {
      username: u,
      credibilityScore,
      tier,
      hitRatePosterior: {
        a: post.a,
        b: post.b,
        mean: post.mean,
        ciLow: ci.low,
        ciHigh: ci.high,
      },
      recency: {
        halfLifeDays,
        weightedSample: wTotal,
        recencyAdjustedAlpha,
      },
      stability: {
        std7d,
        drawdown,
        consistency,
        spamPenalty,
      },
      trend: {
        direction: trendDir,
        alpha90,
        alpha30,
      },
      computedAt: new Date(),
    };

    await TgCredibilityModel.updateOne({ username: u }, { $set: doc }, { upsert: true });

    this.log('[cred] computed', {
      username: u,
      credibilityScore: credibilityScore.toFixed(1),
      tier,
      trendDir,
      wTotal: wTotal.toFixed(1),
    });

    return doc;
  }

  /**
   * Quick alpha estimate for 30d using evaluated mentions
   */
  private async computeAlphaQuick(username: string, days: number): Promise<number> {
    const since = new Date(Date.now() - days * 86400000);

    const m = await TgTokenMentionModel.find({
      username,
      evaluated: true,
      mentionedAt: { $gte: since },
    })
      .select('returns')
      .lean();

    const n = m.length;
    if (n < 6) return 0;

    const r7 = m
      .map((x: any) => Number(x.returns?.r7d ?? 0))
      .filter(Number.isFinite);
    const succ7 = r7.filter((v) => v >= 10).length;

    // Posterior mean
    const hit7 = (0.18 * 16 + succ7) / (16 + r7.length);
    const avg7 = r7.reduce((a, b) => a + b, 0) / r7.length;

    const rarScore = sigmoid(avg7 / (1 + Math.abs(avg7) / 25) / 10);
    const base = 0.65 * hit7 + 0.35 * rarScore;

    const sampleConfidence = clamp01(Math.sqrt(n / 40));
    return clamp100(base * sampleConfidence * 100);
  }

  /**
   * Batch compute credibility for channels
   */
  async computeBatch(limit = 50) {
    const channels = await TgAlphaScoreModel.find({ sampleSize: { $gte: 8 } })
      .sort({ alphaScore: -1 })
      .limit(limit)
      .select('username')
      .lean();

    let computed = 0;
    for (const ch of channels) {
      await this.compute((ch as any).username);
      computed++;
    }

    return { ok: true, computed };
  }

  /**
   * Get channel credibility
   */
  async getChannelCredibility(username: string) {
    const u = username.toLowerCase();
    const doc = await TgCredibilityModel.findOne({ username: u }).select('-_id -__v').lean();
    return { ok: !!doc, doc };
  }

  /**
   * Get leaderboard by credibility
   */
  async getLeaderboard(limit = 20) {
    const items = await TgCredibilityModel.find({})
      .sort({ credibilityScore: -1 })
      .limit(limit)
      .select('-_id -__v')
      .lean();

    return { ok: true, items };
  }
}
