/**
 * Ranking Snapshot Service
 * 
 * Computes final score with breakdown
 */
import { TgMetricsWindowModel } from '../models/tg.metrics_window.model.js';
import { TgFraudSignalModel } from '../models/tg.fraud_signal.model.js';
import { TgRankingModel } from '../../telegram-discovery/models/tg_rankings.model.js';
import { TgChannelModel } from '../models_compat/tg.channel.model.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function logNorm(x: number, max = 2000000): number {
  return clamp01(Math.log1p(x) / Math.log1p(max));
}

export class RankingSnapshotService {
  async compute(username: string): Promise<number | null> {
    const m = await TgMetricsWindowModel.findOne({ username, window: '30d' }).lean();
    const f = await TgFraudSignalModel.findOne({ username }).lean();
    const channel = await TgChannelModel.findOne({ username }).lean();

    if (!m) return null;

    // Component scores
    const reachScore = logNorm(m.medianViews || 0);
    const activityScore = clamp01((m.postsPerDay || 0) / 5);
    const engagementScore = clamp01((m.forwardRate || 0) * 20 + (m.replyRate || 0) * 10);
    const consistencyScore = clamp01(m.activeDaysRatio || 0);

    // Base score
    const base =
      0.4 * reachScore +
      0.25 * activityScore +
      0.25 * engagementScore -
      0.1 * clamp01(m.viewDispersion || 0);

    // Reliability from fraud
    const fraudRisk = f?.fraudRisk || 0;
    const reliability = 1 - fraudRisk;

    // Final score
    const score = 100 * clamp01(base) * Math.pow(reliability, 1.3);

    // Trust level
    let trustLevel: 'A' | 'B' | 'C' | 'D' = 'A';
    if (fraudRisk > 0.7) trustLevel = 'D';
    else if (fraudRisk > 0.4) trustLevel = 'C';
    else if (fraudRisk > 0.2) trustLevel = 'B';

    // Get previous ranking for delta
    const prevRanking = await TgRankingModel.findOne({ username })
      .sort({ date: -1 })
      .lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await TgRankingModel.updateOne(
      { username, date: today },
      {
        $set: {
          channelId: channel?.channelId || `seed_${username}`,
          rank: 0, // Will be computed in ranking job
          previousRank: prevRanking?.rank,
          rankChange: 0,
          overallScore: score,
          fraudRisk,
          trustLevel,
          reachScore,
          activityScore,
          engagementScore,
          consistencyScore,
          channelSnapshot: {
            username,
            title: channel?.title || username,
            subscriberCount: channel?.subscriberCount,
            category: channel?.category,
          },
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Update channel with latest score
    await TgChannelModel.updateOne(
      { username },
      {
        rankingScore: score,
        qualityScore: score,
        fraudScore: fraudRisk * 100,
      }
    );

    return score;
  }

  /**
   * Assign ranks based on scores
   */
  async assignRanks(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rankings = await TgRankingModel.find({ date: today })
      .sort({ overallScore: -1 })
      .lean();

    for (let i = 0; i < rankings.length; i++) {
      const rank = i + 1;
      const prev = rankings[i].previousRank;
      const rankChange = prev ? prev - rank : 0;

      await TgRankingModel.updateOne(
        { _id: rankings[i]._id },
        { rank, rankChange }
      );
    }

    return rankings.length;
  }
}
