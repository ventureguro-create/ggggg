/**
 * Fraud Detection Service
 * 
 * Обнаружение ботов и накрутки
 */
import { TgChannelModel, TgMetricsModel, TgPostModel } from '../models/index.js';

export interface FraudIndicators {
  suspiciousGrowth: boolean;      // Аномальный рост подписчиков
  lowEngagement: boolean;          // Подозрительно низкий engagement
  irregularPosting: boolean;       // Нерегулярные посты
  botLikePatterns: boolean;        // Паттерны бот-активности
  suspiciousViews: boolean;        // Накрученные просмотры
}

export interface FraudAnalysisResult {
  channelId: string;
  fraudScore: number;              // 0-100 (higher = more suspicious)
  indicators: FraudIndicators;
  confidence: number;              // 0-1
  details: string[];
}

class FraudService {
  /**
   * Analyze channel for fraud indicators
   */
  async analyzeChannel(channelId: string): Promise<FraudAnalysisResult> {
    const indicators: FraudIndicators = {
      suspiciousGrowth: false,
      lowEngagement: false,
      irregularPosting: false,
      botLikePatterns: false,
      suspiciousViews: false,
    };
    const details: string[] = [];
    let fraudScore = 0;

    // Get channel
    const channel = await TgChannelModel.findOne({ channelId }).lean();
    if (!channel) {
      return {
        channelId,
        fraudScore: 50,
        indicators,
        confidence: 0,
        details: ['Channel not found'],
      };
    }

    // Get metrics for analysis
    const since = new Date();
    since.setDate(since.getDate() - 14); // Last 2 weeks

    const metrics = await TgMetricsModel
      .find({ channelId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .lean();

    if (metrics.length < 3) {
      return {
        channelId,
        fraudScore: 30,
        indicators,
        confidence: 0.3,
        details: ['Insufficient data for analysis'],
      };
    }

    // 1. Check for suspicious growth spikes
    const growthRates = metrics.map(m => m.growthRate);
    const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    const maxGrowth = Math.max(...growthRates);
    
    if (maxGrowth > avgGrowth * 5 && maxGrowth > 0.1) {
      indicators.suspiciousGrowth = true;
      fraudScore += 25;
      details.push(`Suspicious growth spike detected: ${(maxGrowth * 100).toFixed(1)}%`);
    }

    // 2. Check engagement ratio
    const avgEngagement = metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length;
    
    if (channel.subscriberCount && channel.subscriberCount > 10000) {
      if (avgEngagement < 0.01) {  // Less than 1% engagement
        indicators.lowEngagement = true;
        fraudScore += 20;
        details.push(`Very low engagement: ${(avgEngagement * 100).toFixed(2)}%`);
      }
    }

    // 3. Check posting patterns
    const postsPerHour = metrics.map(m => m.postsCount);
    const postVariance = this.calculateVariance(postsPerHour);
    
    if (postVariance > 10) {
      indicators.irregularPosting = true;
      fraudScore += 15;
      details.push('Irregular posting patterns detected');
    }

    // 4. Check for bot-like view patterns
    const posts = await TgPostModel
      .find({ channelId, postedAt: { $gte: since } })
      .lean();

    if (posts.length > 10) {
      const views = posts.map(p => p.views);
      const viewVariance = this.calculateVariance(views);
      const avgViews = views.reduce((a, b) => a + b, 0) / views.length;
      
      // Very consistent views = suspicious
      if (avgViews > 0 && viewVariance / avgViews < 0.05) {
        indicators.botLikePatterns = true;
        fraudScore += 20;
        details.push('Suspiciously consistent view counts');
      }

      // Views much higher than subscribers = suspicious
      if (channel.subscriberCount && avgViews > channel.subscriberCount * 2) {
        indicators.suspiciousViews = true;
        fraudScore += 20;
        details.push(`Views (${avgViews.toFixed(0)}) exceed 2x subscribers (${channel.subscriberCount})`);
      }
    }

    // Cap fraud score at 100
    fraudScore = Math.min(100, fraudScore);

    // Calculate confidence based on data availability
    const confidence = Math.min(1, metrics.length / 50);

    return {
      channelId,
      fraudScore,
      indicators,
      confidence,
      details,
    };
  }

  /**
   * Batch analyze multiple channels
   */
  async batchAnalyze(channelIds: string[]): Promise<Map<string, FraudAnalysisResult>> {
    const results = new Map<string, FraudAnalysisResult>();
    
    for (const channelId of channelIds) {
      const result = await this.analyzeChannel(channelId);
      results.set(channelId, result);
    }

    return results;
  }

  /**
   * Update fraud scores in database
   */
  async updateFraudScores(): Promise<{ updated: number }> {
    const channels = await TgChannelModel.find({ status: 'active' }).lean();
    let updated = 0;

    for (const channel of channels) {
      const analysis = await this.analyzeChannel(channel.channelId);
      
      await TgChannelModel.updateOne(
        { channelId: channel.channelId },
        { fraudScore: analysis.fraudScore }
      );
      updated++;
    }

    return { updated };
  }

  /**
   * Calculate variance of numbers array
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }
}

export const fraudService = new FraudService();
