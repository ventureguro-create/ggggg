/**
 * Advanced Rating Service
 * 
 * Fair ranking with:
 * - Bayesian smoothing
 * - Stability penalties
 * - Reliability weighting
 * - Promo penalties
 * - Originality boost
 * - Source diversity penalties
 * - Cross-reuse penalties
 */
import { TgChannelModel } from '../models/index.js';
import { TgMetricsModel } from '../models/tg_metrics.model.js';
import { TgRankingModel } from '../models/tg_rankings.model.js';
import { clamp01, logNorm, bayesianAverage } from '../utils/math.js';

export type TrustLevel = 'A' | 'B' | 'C' | 'D';

class AdvancedRatingService {
  /**
   * Calculate daily rankings for all active channels
   */
  async calculateDailyRankings(date?: Date): Promise<{
    ok: boolean;
    ranked: number;
    error?: string;
  }> {
    try {
      const targetDate = this.getDailyBucket(date || new Date());
      
      // Get all active channels
      const channels = await TgChannelModel.find({ status: 'active' }).lean();
      
      // Calculate scores for each channel
      const scores: Array<{
        username: string;
        channelId: string;
        overallScore: number;
        fraudRisk: number;
        trustLevel: TrustLevel;
        reachScore: number;
        activityScore: number;
        engagementScore: number;
        consistencyScore: number;
        channel: typeof channels[0];
      }> = [];

      for (const channel of channels) {
        const result = await this.computeScore(channel.username);
        
        if (result) {
          scores.push({
            username: channel.username,
            channelId: channel.channelId,
            overallScore: result.finalScore,
            fraudRisk: result.fraudRisk,
            trustLevel: result.trustLevel,
            reachScore: result.reachScore,
            activityScore: result.activityScore,
            engagementScore: result.engagementScore,
            consistencyScore: result.consistencyScore,
            channel,
          });
        }
      }

      // Sort by overall score
      scores.sort((a, b) => b.overallScore - a.overallScore);

      // Get previous rankings
      const previousDate = new Date(targetDate);
      previousDate.setDate(previousDate.getDate() - 1);
      
      const previousRankings = await TgRankingModel
        .find({ date: previousDate })
        .lean();
      
      const previousRankMap = new Map(
        previousRankings.map(r => [r.username, r.rank])
      );

      // Save rankings
      for (let i = 0; i < scores.length; i++) {
        const score = scores[i];
        const rank = i + 1;
        const previousRank = previousRankMap.get(score.username);
        
        await TgRankingModel.findOneAndUpdate(
          { username: score.username, date: targetDate },
          {
            channelId: score.channelId,
            rank,
            previousRank,
            rankChange: previousRank ? previousRank - rank : 0,
            overallScore: score.overallScore,
            fraudRisk: score.fraudRisk,
            trustLevel: score.trustLevel,
            reachScore: score.reachScore,
            activityScore: score.activityScore,
            engagementScore: score.engagementScore,
            consistencyScore: score.consistencyScore,
            channelSnapshot: {
              username: score.channel.username,
              title: score.channel.title,
              subscriberCount: score.channel.subscriberCount,
              category: score.channel.category,
            },
            computedAt: new Date(),
          },
          { upsert: true }
        );

        // Update channel
        await TgChannelModel.updateOne(
          { username: score.username },
          { 
            rankingScore: score.overallScore,
            qualityScore: score.overallScore,
            fraudScore: score.fraudRisk * 100,
          }
        );
      }

      return { ok: true, ranked: scores.length };
    } catch (error) {
      console.error('[Rating] Calculate error:', error);
      return { ok: false, ranked: 0, error: String(error) };
    }
  }

  /**
   * Compute score for a single channel (ADVANCED)
   */
  async computeScore(username: string, fraudRisk?: number): Promise<{
    finalScore: number;
    fraudRisk: number;
    trustLevel: TrustLevel;
    reachScore: number;
    activityScore: number;
    engagementScore: number;
    consistencyScore: number;
  } | null> {
    const m = await TgMetricsModel.findOne({ username }).lean() as any;
    if (!m) return null;

    // If fraud not provided, get from metrics or compute
    if (fraudRisk === undefined) {
      fraudRisk = Number(m.fraudScore || 0) / 100 || 0.3;
    }

    // ========== Component scores ==========
    const reachScore = logNorm(m.medianViews || 0);
    const activityScore = clamp01((m.postsPerDay || 0) / 6);
    
    const engagementRaw = (m.forwardRate || 0) * 25 + (m.replyRate || 0) * 12;
    const engagementScore = bayesianAverage(
      clamp01(engagementRaw),
      m.postsCount || 0,
      0.4,
      15
    );

    const stabilityPenalty = clamp01(m.viewDispersion || 0);
    const consistencyScore = clamp01(1 - stabilityPenalty);

    // ========== Base score ==========
    const base =
      0.4 * reachScore +
      0.2 * activityScore +
      0.25 * engagementScore -
      0.15 * stabilityPenalty;

    // ========== Reliability from fraud ==========
    const reliability = 1 - fraudRisk;

    // ========== Promo penalty ==========
    const promoScore = Number(m.promoScore || 0);
    const promoPenalty = Math.pow(1 - Math.min(0.6, promoScore * 0.6), 1.1);

    // ========== Originality boost ==========
    const orig = Number(m.originalityScore ?? 1);
    const originalityBoost = 0.92 + 0.08 * Math.max(0, Math.min(1, orig));

    // ========== Feed/repostiness penalty ==========
    const repostiness = Number(m.repostinessScore || 0);
    const feedPenalty = 0.88 + 0.12 * (1 - Math.min(1, repostiness));

    // ========== Source diversity penalty ==========
    const forwardedTotal = Number(m.forwardedTotal || 0);
    const domRatio = Number(m.dominantSourceRatio || 0);
    const diversity = Number(m.diversityScore ?? 1);

    let sourcePenalty = 1.0;
    if (forwardedTotal >= 8) {
      const domPenalty = 1 - Math.min(0.10, Math.max(0, domRatio - 0.55) * 0.18);
      const divPenalty = 1 - Math.min(0.08, Math.max(0, 0.55 - diversity) * 0.20);
      sourcePenalty = domPenalty * divPenalty;
    }

    // ========== Cross-reuse penalty ==========
    const reuseScore = Number(m.reuseScore || 0);
    const reusePenalty = 1 - Math.min(0.15, reuseScore * 0.15);

    // ========== Final score ==========
    const finalScore = 100 * clamp01(base) 
      * Math.pow(reliability, 1.3) 
      * promoPenalty 
      * originalityBoost 
      * feedPenalty 
      * sourcePenalty 
      * reusePenalty;

    // ========== Trust level ==========
    let trustLevel: TrustLevel = 'A';
    if (fraudRisk > 0.7) trustLevel = 'D';
    else if (fraudRisk > 0.4) trustLevel = 'C';
    else if (fraudRisk > 0.2) trustLevel = 'B';

    return {
      finalScore,
      fraudRisk,
      trustLevel,
      reachScore,
      activityScore,
      engagementScore,
      consistencyScore,
    };
  }

  /**
   * Get latest rankings
   */
  async getLatestRankings(limit: number = 50): Promise<Array<{
    rank: number;
    username: string;
    title: string;
    overallScore: number;
    trustLevel: TrustLevel;
    rankChange: number;
    subscriberCount: number;
  }>> {
    const latestRanking = await TgRankingModel
      .findOne()
      .sort({ date: -1 })
      .lean();

    if (!latestRanking) return [];

    const rankings = await TgRankingModel
      .find({ date: latestRanking.date })
      .sort({ rank: 1 })
      .limit(limit)
      .lean();

    return rankings.map(r => ({
      rank: r.rank,
      username: r.channelSnapshot.username,
      title: r.channelSnapshot.title,
      overallScore: r.overallScore,
      trustLevel: r.trustLevel,
      rankChange: r.rankChange,
      subscriberCount: r.channelSnapshot.subscriberCount || 0,
    }));
  }

  /**
   * Get channel ranking history
   */
  async getChannelRankingHistory(username: string, days: number = 30): Promise<Array<{
    date: Date;
    rank: number;
    overallScore: number;
    trustLevel: TrustLevel;
  }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rankings = await TgRankingModel
      .find({
        username,
        date: { $gte: since }
      })
      .sort({ date: 1 })
      .lean();

    return rankings.map(r => ({
      date: r.date,
      rank: r.rank,
      overallScore: r.overallScore,
      trustLevel: r.trustLevel,
    }));
  }

  private getDailyBucket(date: Date): Date {
    const bucket = new Date(date);
    bucket.setHours(0, 0, 0, 0);
    return bucket;
  }
}

export const advancedRatingService = new AdvancedRatingService();
