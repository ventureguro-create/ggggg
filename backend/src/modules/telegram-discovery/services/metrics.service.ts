/**
 * Metrics Service
 * 
 * Сбор и расчёт метрик для каналов
 */
import { TgChannelModel, TgMetricsModel, TgPostModel } from '../models/index.js';

export interface CalculateMetricsParams {
  channelId: string;
  timestamp?: Date;  // Defaults to current hour
}

class MetricsService {
  /**
   * Calculate hourly metrics snapshot for a channel
   */
  async calculateHourlyMetrics(params: CalculateMetricsParams): Promise<{
    ok: boolean;
    metrics?: {
      subscriberCount: number;
      subscriberDelta: number;
      postsCount: number;
      avgViews: number;
      engagementRate: number;
    };
    error?: string;
  }> {
    try {
      const { channelId } = params;
      const timestamp = this.getHourlyBucket(params.timestamp || new Date());

      // Get channel
      const channel = await TgChannelModel.findOne({ channelId });
      if (!channel) {
        return { ok: false, error: 'Channel not found' };
      }

      // Get previous snapshot for delta calculation
      const previousMetrics = await TgMetricsModel
        .findOne({ channelId })
        .sort({ timestamp: -1 })
        .lean();

      // Get posts in this hour
      const hourStart = timestamp;
      const hourEnd = new Date(timestamp.getTime() + 60 * 60 * 1000);
      
      const postsInHour = await TgPostModel.find({
        channelId,
        postedAt: { $gte: hourStart, $lt: hourEnd }
      }).lean();

      // Calculate metrics
      const subscriberCount = channel.subscriberCount || 0;
      const subscriberDelta = previousMetrics 
        ? subscriberCount - previousMetrics.subscriberCount 
        : 0;

      const postsCount = postsInHour.length;
      const totalViews = postsInHour.reduce((sum, p) => sum + (p.views || 0), 0);
      const avgViews = postsCount > 0 ? totalViews / postsCount : 0;
      const maxViews = postsCount > 0 ? Math.max(...postsInHour.map(p => p.views || 0)) : 0;

      const engagementRate = subscriberCount > 0 ? avgViews / subscriberCount : 0;
      const growthRate = previousMetrics?.subscriberCount 
        ? subscriberDelta / previousMetrics.subscriberCount 
        : 0;

      // Upsert metrics
      await TgMetricsModel.findOneAndUpdate(
        { channelId, timestamp },
        {
          subscriberCount,
          subscriberDelta,
          postsCount,
          totalViews,
          avgViews,
          maxViews,
          engagementRate,
          growthRate,
          forwardsReceived: 0,  // TODO: Calculate from edges
          mentionsReceived: 0,  // TODO: Calculate from edges
        },
        { upsert: true, new: true }
      );

      return {
        ok: true,
        metrics: {
          subscriberCount,
          subscriberDelta,
          postsCount,
          avgViews,
          engagementRate,
        }
      };
    } catch (error) {
      console.error('[Metrics] Calculate error:', error);
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Get metrics history for a channel
   */
  async getMetricsHistory(channelId: string, days: number = 7): Promise<Array<{
    timestamp: Date;
    subscriberCount: number;
    postsCount: number;
    avgViews: number;
    engagementRate: number;
  }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await TgMetricsModel
      .find({
        channelId,
        timestamp: { $gte: since }
      })
      .sort({ timestamp: 1 })
      .lean();

    return metrics.map(m => ({
      timestamp: m.timestamp,
      subscriberCount: m.subscriberCount,
      postsCount: m.postsCount,
      avgViews: m.avgViews,
      engagementRate: m.engagementRate,
    }));
  }

  /**
   * Update channel with latest metrics
   */
  async updateChannelMetrics(channelId: string): Promise<void> {
    const latestMetrics = await TgMetricsModel
      .findOne({ channelId })
      .sort({ timestamp: -1 })
      .lean();

    if (latestMetrics) {
      await TgChannelModel.updateOne(
        { channelId },
        {
          subscriberCount: latestMetrics.subscriberCount,
          avgPostViews: latestMetrics.avgViews,
          avgEngagement: latestMetrics.engagementRate,
          lastChecked: new Date(),
        }
      );
    }
  }

  /**
   * Get hourly bucket timestamp
   */
  private getHourlyBucket(date: Date): Date {
    const bucket = new Date(date);
    bucket.setMinutes(0, 0, 0);
    return bucket;
  }
}

export const metricsService = new MetricsService();
