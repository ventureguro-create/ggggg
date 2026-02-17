/**
 * Ranking Service
 * 
 * Расчёт рейтингов и скоринга каналов
 */
import { TgChannelModel, TgRankingModel, TgMetricsModel } from '../models/index.js';

export interface RankingWeights {
  quality: number;
  engagement: number;
  growth: number;
  consistency: number;
  fraud: number;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  quality: 0.25,
  engagement: 0.25,
  growth: 0.20,
  consistency: 0.15,
  fraud: 0.15,
};

class RankingService {
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
        channelId: string;
        overallScore: number;
        qualityScore: number;
        engagementScore: number;
        growthScore: number;
        consistencyScore: number;
        fraudScore: number;
        channel: typeof channels[0];
      }> = [];

      for (const channel of channels) {
        const channelScores = await this.calculateChannelScores(channel.channelId);
        
        // Calculate overall score
        const overallScore = 
          channelScores.quality * DEFAULT_WEIGHTS.quality +
          channelScores.engagement * DEFAULT_WEIGHTS.engagement +
          channelScores.growth * DEFAULT_WEIGHTS.growth +
          channelScores.consistency * DEFAULT_WEIGHTS.consistency -
          channelScores.fraud * DEFAULT_WEIGHTS.fraud;  // Subtract fraud

        scores.push({
          channelId: channel.channelId,
          overallScore: Math.max(0, Math.min(100, overallScore)),
          qualityScore: channelScores.quality,
          engagementScore: channelScores.engagement,
          growthScore: channelScores.growth,
          consistencyScore: channelScores.consistency,
          fraudScore: channelScores.fraud,
          channel,
        });
      }

      // Sort by overall score and assign ranks
      scores.sort((a, b) => b.overallScore - a.overallScore);

      // Get previous rankings for delta calculation
      const previousDate = new Date(targetDate);
      previousDate.setDate(previousDate.getDate() - 1);
      
      const previousRankings = await TgRankingModel
        .find({ date: previousDate })
        .lean();
      
      const previousRankMap = new Map(
        previousRankings.map(r => [r.channelId, r.rank])
      );

      // Save rankings
      for (let i = 0; i < scores.length; i++) {
        const score = scores[i];
        const rank = i + 1;
        const previousRank = previousRankMap.get(score.channelId);
        
        await TgRankingModel.findOneAndUpdate(
          { channelId: score.channelId, date: targetDate },
          {
            rank,
            previousRank,
            rankChange: previousRank ? previousRank - rank : 0,
            overallScore: score.overallScore,
            qualityScore: score.qualityScore,
            engagementScore: score.engagementScore,
            growthScore: score.growthScore,
            consistencyScore: score.consistencyScore,
            fraudScore: score.fraudScore,
            weights: DEFAULT_WEIGHTS,
            channelSnapshot: {
              username: score.channel.username,
              title: score.channel.title,
              subscriberCount: score.channel.subscriberCount,
              category: score.channel.category,
            },
          },
          { upsert: true }
        );

        // Update channel ranking score
        await TgChannelModel.updateOne(
          { channelId: score.channelId },
          { 
            rankingScore: score.overallScore,
            qualityScore: score.qualityScore,
            fraudScore: score.fraudScore,
          }
        );
      }

      return { ok: true, ranked: scores.length };
    } catch (error) {
      console.error('[Ranking] Calculate error:', error);
      return { ok: false, ranked: 0, error: String(error) };
    }
  }

  /**
   * Calculate individual channel scores
   */
  private async calculateChannelScores(channelId: string): Promise<{
    quality: number;
    engagement: number;
    growth: number;
    consistency: number;
    fraud: number;
  }> {
    // Get last 7 days of metrics
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const metrics = await TgMetricsModel
      .find({ channelId, timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .lean();

    if (metrics.length === 0) {
      return { quality: 50, engagement: 50, growth: 50, consistency: 50, fraud: 50 };
    }

    // Engagement score (based on avg views / subscribers)
    const avgEngagement = metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length;
    const engagementScore = Math.min(100, avgEngagement * 100 * 10); // Scale up

    // Growth score (based on subscriber growth)
    const avgGrowth = metrics.reduce((sum, m) => sum + m.growthRate, 0) / metrics.length;
    const growthScore = Math.min(100, Math.max(0, 50 + avgGrowth * 1000)); // Centered at 50

    // Consistency score (based on posting regularity)
    const postsPerDay = metrics.reduce((sum, m) => sum + m.postsCount, 0) / 7;
    const consistencyScore = Math.min(100, postsPerDay * 10); // 10 posts/day = 100

    // Quality score (placeholder - would need NLP analysis)
    const qualityScore = 60; // Default to 60

    // Fraud score (placeholder - would need bot detection)
    const fraudScore = 20; // Default low

    return {
      quality: qualityScore,
      engagement: engagementScore,
      growth: growthScore,
      consistency: consistencyScore,
      fraud: fraudScore,
    };
  }

  /**
   * Get latest rankings
   */
  async getLatestRankings(limit: number = 50): Promise<Array<{
    rank: number;
    channelId: string;
    username: string;
    title: string;
    overallScore: number;
    rankChange: number;
    subscriberCount: number;
  }>> {
    // Get most recent date with rankings
    const latestRanking = await TgRankingModel
      .findOne()
      .sort({ date: -1 })
      .lean();

    if (!latestRanking) {
      return [];
    }

    const rankings = await TgRankingModel
      .find({ date: latestRanking.date })
      .sort({ rank: 1 })
      .limit(limit)
      .lean();

    return rankings.map(r => ({
      rank: r.rank,
      channelId: r.channelId,
      username: r.channelSnapshot.username,
      title: r.channelSnapshot.title,
      overallScore: r.overallScore,
      rankChange: r.rankChange,
      subscriberCount: r.channelSnapshot.subscriberCount || 0,
    }));
  }

  /**
   * Get channel ranking history
   */
  async getChannelRankingHistory(channelId: string, days: number = 30): Promise<Array<{
    date: Date;
    rank: number;
    overallScore: number;
  }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rankings = await TgRankingModel
      .find({
        channelId,
        date: { $gte: since }
      })
      .sort({ date: 1 })
      .lean();

    return rankings.map(r => ({
      date: r.date,
      rank: r.rank,
      overallScore: r.overallScore,
    }));
  }

  /**
   * Get daily bucket timestamp
   */
  private getDailyBucket(date: Date): Date {
    const bucket = new Date(date);
    bucket.setHours(0, 0, 0, 0);
    return bucket;
  }
}

export const rankingService = new RankingService();
