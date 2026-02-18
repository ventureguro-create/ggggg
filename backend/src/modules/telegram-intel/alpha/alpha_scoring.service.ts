/**
 * Alpha Scoring Service
 * Phase 3 Step 3: Institutional-grade scoring engine
 * 
 * Calculates alpha metrics for Telegram channels based on their token mentions:
 * - successRate: % of mentions with >10% gain at 7d
 * - avgReturn: mean return across evaluated mentions
 * - earlynessFactor: how early channel catches tokens
 * - consistency: variance-adjusted performance
 * - alphaScore: composite weighted score (0..100)
 * 
 * Formula:
 * alphaScore = (successRate * 35) + (normalizedAvgReturn * 25) + 
 *              (earlynessFactor * 20) + (consistency * 15) + (hitRate * 5)
 */
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';
import { TgChannelAlphaModel } from '../models/tg.channel_alpha.model.js';

// Thresholds
const SUCCESS_THRESHOLD = 10;  // % gain to count as "success"
const MIN_MENTIONS_FOR_SCORE = 3; // minimum mentions to calculate score
const OUTLIER_PERCENTILE = 95;    // cap returns at this percentile

interface ChannelMentionData {
  token: string;
  mentionedAt: Date;
  r7d: number | null;
  r30d: number | null;
}

interface AlphaMetrics {
  successRate: number;
  avgReturn7d: number;
  avgReturn30d: number;
  earlynessFactor: number;
  consistency: number;
  hitRate: number;
  alphaScore: number;
  totalMentions: number;
  evaluatedMentions: number;
  successfulMentions: number;
  bestMention: { token: string; mentionedAt: Date; return7d: number } | null;
  returnDistribution: { positive: number; negative: number; stdDev: number };
}

export class AlphaScoringService {
  private log: (msg: string, meta?: any) => void;

  constructor(log?: (msg: string, meta?: any) => void) {
    this.log = log || console.log;
  }

  /**
   * Calculate alpha score for a single channel
   */
  async calculateChannelAlpha(
    username: string,
    windowDays = 90
  ): Promise<{ ok: boolean; metrics: AlphaMetrics | null; error?: string }> {
    const normalizedUsername = username.toLowerCase();
    const since = new Date(Date.now() - windowDays * 86400000);

    // Get all evaluated mentions with price data
    const mentions = await TgTokenMentionModel.find({
      username: normalizedUsername,
      evaluated: true,
      priceAtMention: { $ne: null },
      mentionedAt: { $gte: since },
    })
      .select('token mentionedAt returns.r7d returns.r30d')
      .lean();

    const totalMentions = await TgTokenMentionModel.countDocuments({
      username: normalizedUsername,
      mentionedAt: { $gte: since },
    });

    if (mentions.length < MIN_MENTIONS_FOR_SCORE) {
      return {
        ok: false,
        metrics: null,
        error: `insufficient_data: ${mentions.length}/${MIN_MENTIONS_FOR_SCORE} evaluated mentions`,
      };
    }

    // Extract return data
    const mentionData: ChannelMentionData[] = mentions.map((m: any) => ({
      token: m.token,
      mentionedAt: new Date(m.mentionedAt),
      r7d: m.returns?.r7d ?? null,
      r30d: m.returns?.r30d ?? null,
    }));

    // Calculate metrics
    const metrics = this.computeMetrics(mentionData, totalMentions, windowDays);

    // Save to DB
    await TgChannelAlphaModel.updateOne(
      { username: normalizedUsername },
      {
        $set: {
          ...metrics,
          lastCalculated: new Date(),
          calculationWindow: windowDays,
        },
      },
      { upsert: true }
    );

    this.log('[alpha-scoring] Channel score calculated', {
      username: normalizedUsername,
      alphaScore: metrics.alphaScore.toFixed(2),
      successRate: (metrics.successRate * 100).toFixed(1) + '%',
      mentions: metrics.evaluatedMentions,
    });

    return { ok: true, metrics };
  }

  /**
   * Batch calculate scores for all channels with sufficient data
   */
  async calculateBatch(
    limit = 50,
    windowDays = 90
  ): Promise<{
    ok: boolean;
    processed: number;
    calculated: number;
    skipped: number;
  }> {
    // Get channels with evaluated mentions
    const channelsWithMentions = await TgTokenMentionModel.aggregate([
      {
        $match: {
          evaluated: true,
          priceAtMention: { $ne: null },
          mentionedAt: { $gte: new Date(Date.now() - windowDays * 86400000) },
        },
      },
      {
        $group: {
          _id: '$username',
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: MIN_MENTIONS_FOR_SCORE } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    let calculated = 0;
    let skipped = 0;

    for (const ch of channelsWithMentions) {
      const result = await this.calculateChannelAlpha(ch._id, windowDays);
      if (result.ok) {
        calculated++;
      } else {
        skipped++;
      }
    }

    return {
      ok: true,
      processed: channelsWithMentions.length,
      calculated,
      skipped,
    };
  }

  /**
   * Get top channels by alpha score
   */
  async getLeaderboard(
    limit = 20
  ): Promise<{
    ok: boolean;
    channels: Array<{
      username: string;
      alphaScore: number;
      successRate: number;
      avgReturn7d: number;
      consistency: number;
      totalMentions: number;
      lastCalculated: Date;
    }>;
  }> {
    const channels = await TgChannelAlphaModel.find({
      evaluatedMentions: { $gte: MIN_MENTIONS_FOR_SCORE },
    })
      .sort({ alphaScore: -1 })
      .limit(limit)
      .select('-_id -__v -returnDistribution -bestMention')
      .lean();

    return {
      ok: true,
      channels: channels.map((c: any) => ({
        username: c.username,
        alphaScore: Math.round(c.alphaScore * 10) / 10,
        successRate: Math.round(c.successRate * 1000) / 10,
        avgReturn7d: Math.round(c.avgReturn7d * 10) / 10,
        consistency: Math.round(c.consistency * 100) / 100,
        totalMentions: c.totalMentions,
        lastCalculated: c.lastCalculated,
      })),
    };
  }

  /**
   * Get channel alpha details
   */
  async getChannelAlpha(
    username: string
  ): Promise<{ ok: boolean; alpha: any | null }> {
    const normalizedUsername = username.toLowerCase();

    const alpha = await TgChannelAlphaModel.findOne({
      username: normalizedUsername,
    })
      .select('-_id -__v')
      .lean();

    if (!alpha) {
      return { ok: false, alpha: null };
    }

    return { ok: true, alpha };
  }

  /**
   * Get scoring stats across all channels
   */
  async getStats(): Promise<{
    totalChannels: number;
    avgAlphaScore: number;
    topScore: number;
    avgSuccessRate: number;
  }> {
    const stats = await TgChannelAlphaModel.aggregate([
      { $match: { evaluatedMentions: { $gte: MIN_MENTIONS_FOR_SCORE } } },
      {
        $group: {
          _id: null,
          totalChannels: { $sum: 1 },
          avgAlphaScore: { $avg: '$alphaScore' },
          topScore: { $max: '$alphaScore' },
          avgSuccessRate: { $avg: '$successRate' },
        },
      },
    ]);

    if (!stats.length) {
      return {
        totalChannels: 0,
        avgAlphaScore: 0,
        topScore: 0,
        avgSuccessRate: 0,
      };
    }

    return {
      totalChannels: stats[0].totalChannels || 0,
      avgAlphaScore: Math.round((stats[0].avgAlphaScore || 0) * 10) / 10,
      topScore: Math.round((stats[0].topScore || 0) * 10) / 10,
      avgSuccessRate: Math.round((stats[0].avgSuccessRate || 0) * 1000) / 10,
    };
  }

  // ==================== Private Methods ====================

  /**
   * Compute all metrics from mention data
   */
  private computeMetrics(
    mentions: ChannelMentionData[],
    totalMentions: number,
    windowDays: number
  ): AlphaMetrics {
    // Filter mentions with valid 7d returns
    const withReturns = mentions.filter((m) => m.r7d !== null);

    if (!withReturns.length) {
      return this.emptyMetrics(totalMentions);
    }

    const returns7d = withReturns.map((m) => m.r7d as number);
    const returns30d = mentions
      .filter((m) => m.r30d !== null)
      .map((m) => m.r30d as number);

    // Cap outliers
    const cappedReturns = this.capOutliers(returns7d, OUTLIER_PERCENTILE);

    // Success rate: % with >10% gain at 7d
    const successfulMentions = cappedReturns.filter(
      (r) => r >= SUCCESS_THRESHOLD
    ).length;
    const successRate = successfulMentions / withReturns.length;

    // Hit rate: % with any positive return
    const positive = cappedReturns.filter((r) => r > 0).length;
    const negative = cappedReturns.filter((r) => r <= 0).length;
    const hitRate = positive / withReturns.length;

    // Average returns
    const avgReturn7d = this.mean(cappedReturns);
    const avgReturn30d = returns30d.length ? this.mean(returns30d) : 0;

    // Standard deviation & consistency
    const stdDev = this.standardDeviation(cappedReturns);
    // Consistency: inverse of coefficient of variation (lower variance = higher consistency)
    // Normalized to 0..1, higher is better
    const cv = avgReturn7d !== 0 ? Math.abs(stdDev / avgReturn7d) : 10;
    const consistency = Math.max(0, Math.min(1, 1 - cv / 10));

    // Earliness factor: placeholder (needs cross-channel data)
    // For now, use recency of first mention as proxy
    const earlynessFactor = this.calculateEarliness(mentions, windowDays);

    // Find best mention
    let bestMention: { token: string; mentionedAt: Date; return7d: number } | null = null;
    if (withReturns.length) {
      const sorted = [...withReturns].sort(
        (a, b) => (b.r7d as number) - (a.r7d as number)
      );
      const best = sorted[0];
      bestMention = {
        token: best.token,
        mentionedAt: best.mentionedAt,
        return7d: best.r7d as number,
      };
    }

    // Calculate composite alpha score (0..100)
    const alphaScore = this.calculateAlphaScore({
      successRate,
      avgReturn7d,
      earlynessFactor,
      consistency,
      hitRate,
    });

    return {
      successRate,
      avgReturn7d,
      avgReturn30d,
      earlynessFactor,
      consistency,
      hitRate,
      alphaScore,
      totalMentions,
      evaluatedMentions: withReturns.length,
      successfulMentions,
      bestMention,
      returnDistribution: { positive, negative, stdDev },
    };
  }

  /**
   * Calculate composite alpha score
   * 
   * Weights:
   * - successRate: 35% (most important - consistent winners)
   * - avgReturn: 25% (magnitude of gains)
   * - earlynessFactor: 20% (catching tokens early)
   * - consistency: 15% (low variance)
   * - hitRate: 5% (any positive return)
   */
  private calculateAlphaScore(metrics: {
    successRate: number;
    avgReturn7d: number;
    earlynessFactor: number;
    consistency: number;
    hitRate: number;
  }): number {
    // Normalize avgReturn to 0..1 scale (cap at 100% return = 1.0)
    const normalizedReturn = Math.min(1, Math.max(0, metrics.avgReturn7d / 100));

    const score =
      metrics.successRate * 35 +
      normalizedReturn * 25 +
      metrics.earlynessFactor * 20 +
      metrics.consistency * 15 +
      metrics.hitRate * 5;

    return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  }

  /**
   * Calculate earliness factor
   * Higher score = channel mentions tokens earlier in their lifecycle
   */
  private calculateEarliness(
    mentions: ChannelMentionData[],
    windowDays: number
  ): number {
    if (!mentions.length) return 0;

    // Group by token, find earliest mention date per token
    const tokenFirstMention = new Map<string, Date>();
    for (const m of mentions) {
      const existing = tokenFirstMention.get(m.token);
      if (!existing || m.mentionedAt < existing) {
        tokenFirstMention.set(m.token, m.mentionedAt);
      }
    }

    // For each unique token, calculate how early in the window it was mentioned
    // Earlier = higher score
    const now = Date.now();
    const windowMs = windowDays * 86400000;
    
    let earlinessSum = 0;
    for (const [, date] of tokenFirstMention) {
      const age = now - date.getTime();
      // Score: 1.0 if mentioned at start of window, 0.0 if mentioned now
      const earliness = Math.min(1, age / windowMs);
      earlinessSum += earliness;
    }

    return tokenFirstMention.size > 0
      ? earlinessSum / tokenFirstMention.size
      : 0;
  }

  /**
   * Cap returns at specified percentile to handle outliers
   */
  private capOutliers(values: number[], percentile: number): number[] {
    if (values.length < 3) return values;

    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor((percentile / 100) * sorted.length);
    const cap = sorted[Math.min(idx, sorted.length - 1)];

    return values.map((v) => Math.min(v, cap));
  }

  private mean(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  private emptyMetrics(totalMentions: number): AlphaMetrics {
    return {
      successRate: 0,
      avgReturn7d: 0,
      avgReturn30d: 0,
      earlynessFactor: 0,
      consistency: 0,
      hitRate: 0,
      alphaScore: 0,
      totalMentions,
      evaluatedMentions: 0,
      successfulMentions: 0,
      bestMention: null,
      returnDistribution: { positive: 0, negative: 0, stdDev: 0 },
    };
  }
}
