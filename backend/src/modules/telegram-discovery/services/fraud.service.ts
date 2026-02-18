/**
 * Advanced Fraud Detection Service
 * 
 * Multi-signal fraud detection with:
 * - View/Sub sanity
 * - Entropy analysis
 * - Engagement elasticity
 * - Temporal anomalies
 * - Promo network detection
 * - Burst detection
 * - Source diversity
 * - Cross-reuse detection
 */
import { TgChannelModel, TgPostModel } from '../models/index.js';
import { TgMetricsModel } from '../models/tg_metrics.model.js';
import { clamp01, shannonEntropy } from '../utils/math.js';

export interface FraudIndicators {
  suspiciousGrowth: boolean;
  lowEngagement: boolean;
  irregularPosting: boolean;
  botLikePatterns: boolean;
  suspiciousViews: boolean;
  highPromoScore: boolean;
  burstAnomaly: boolean;
  lowDiversity: boolean;
  crossReuse: boolean;
}

export interface FraudAnalysisResult {
  channelId: string;
  username: string;
  fraudRisk: number;           // 0-1 (higher = more suspicious)
  indicators: FraudIndicators;
  confidence: number;          // 0-1
  details: string[];
}

class AdvancedFraudService {
  /**
   * Analyze channel for fraud indicators (ADVANCED)
   */
  async analyzeChannel(username: string): Promise<FraudAnalysisResult> {
    const indicators: FraudIndicators = {
      suspiciousGrowth: false,
      lowEngagement: false,
      irregularPosting: false,
      botLikePatterns: false,
      suspiciousViews: false,
      highPromoScore: false,
      burstAnomaly: false,
      lowDiversity: false,
      crossReuse: false,
    };
    const details: string[] = [];
    let risk = 0;

    // Get data
    const channel = await TgChannelModel.findOne({ username }).lean();
    const metrics = await TgMetricsModel.findOne({ username }).lean() as any;
    
    if (!channel) {
      return {
        channelId: '',
        username,
        fraudRisk: 0.5,
        indicators,
        confidence: 0,
        details: ['Channel not found'],
      };
    }

    if (!metrics) {
      return {
        channelId: channel.channelId,
        username,
        fraudRisk: 0.3,
        indicators,
        confidence: 0.3,
        details: ['No metrics data'],
      };
    }

    // Get posts for deeper analysis
    const since = new Date();
    since.setDate(since.getDate() - 14);
    
    const posts = await TgPostModel
      .find({ channelUsername: username, postedAt: { $gte: since } })
      .lean();

    const views = posts.map(p => p.views || 0);

    // ========== 1. Subscriber efficiency anomaly ==========
    if (channel.subscriberCount && metrics.medianViews) {
      const v2s = metrics.medianViews / channel.subscriberCount;
      if (v2s < 0.01) {
        indicators.lowEngagement = true;
        risk += 0.25;
        details.push(`Very low view/sub ratio: ${(v2s * 100).toFixed(2)}%`);
      }
      if (v2s > 0.9) {
        indicators.suspiciousViews = true;
        risk += 0.35;
        details.push(`Suspicious high view/sub ratio: ${(v2s * 100).toFixed(1)}%`);
      }
    }

    // ========== 2. Entropy test ==========
    if (views.length >= 10) {
      const entropy = shannonEntropy(views);
      if (entropy < 2.5) {
        indicators.botLikePatterns = true;
        risk += 0.25;
        details.push(`Low view entropy: ${entropy.toFixed(2)} (too uniform)`);
      }
    }

    // ========== 3. Engagement elasticity ==========
    const avgViews = views.reduce((a, b) => a + b, 0) / (views.length || 1);
    const avgForwards = posts.reduce((s, p) => s + (p.forwards || 0), 0) / (posts.length || 1);
    const elasticity = avgViews > 0 ? avgForwards / avgViews : 0;

    if (avgViews > 20000 && elasticity < 0.003) {
      indicators.lowEngagement = true;
      risk += 0.3;
      details.push(`Low engagement elasticity at high views: ${(elasticity * 100).toFixed(3)}%`);
    }

    // ========== 4. Temporal anomaly (spikes without engagement) ==========
    if (metrics.medianViews > 0) {
      const maxView = Math.max(...views, 0);
      const ratio = maxView / metrics.medianViews;
      if (ratio > 4 && elasticity < 0.01) {
        indicators.suspiciousGrowth = true;
        risk += 0.25;
        details.push(`View spike ratio ${ratio.toFixed(1)}x without engagement`);
      }
    }

    // ========== 5. Dispersion anomaly ==========
    if (metrics.viewDispersion < 0.03) {
      indicators.botLikePatterns = true;
      risk += 0.2;
      details.push('View dispersion too low (artificial uniformity)');
    }

    // ========== 6. Promo network penalty ==========
    const promoScore = Number(metrics.promoScore || 0);
    if (promoScore > 0.5) {
      indicators.highPromoScore = true;
      risk += 0.25 * promoScore;
      details.push(`High promo score: ${(promoScore * 100).toFixed(0)}%`);
    }
    if (promoScore > 0.7 && (metrics.forwardRate || 0) < 0.01) {
      risk += 0.15;
      details.push('High promo + low organic engagement');
    }

    // ========== 7. Burst clusters ==========
    const burstScore = Number(metrics.burstScore || 0);
    if (burstScore > 0.4) {
      indicators.burstAnomaly = true;
      risk += 0.30 * burstScore;
      details.push(`Burst cluster anomaly: ${(burstScore * 100).toFixed(0)}%`);
    }

    // ========== 8. Elasticity score ==========
    const elasticityScore = Number(metrics.elasticityScore || 0);
    risk += 0.25 * elasticityScore;
    if (elasticityScore > 0.5) {
      details.push(`Elasticity anomaly: ${(elasticityScore * 100).toFixed(0)}%`);
    }

    // ========== 9. Originality ==========
    const originalityScore = Number(metrics.originalityScore ?? 1);
    const copyPenalty = Math.max(0, 1 - originalityScore);
    risk += 0.15 * copyPenalty;
    if (originalityScore < 0.5) {
      details.push(`Low originality: ${(originalityScore * 100).toFixed(0)}%`);
    }

    // ========== 10. Repostiness / aggregator ==========
    const repostiness = Number(metrics.repostinessScore || 0);
    risk += 0.18 * repostiness;

    // Combined: repost + burst + low originality
    if (repostiness > 0.7 && originalityScore < 0.4 && burstScore > 0.4) {
      risk += 0.15;
      details.push('Aggregator pattern: high repost + burst + low originality');
    }

    // ========== 11. Source concentration ==========
    const forwardedTotal = Number(metrics.forwardedTotal || 0);
    const domRatio = Number(metrics.dominantSourceRatio || 0);
    const hhi = Number(metrics.sourceHHI || 0);
    const diversity = Number(metrics.diversityScore ?? 1);

    if (forwardedTotal >= 8) {
      if (domRatio > 0.75) {
        indicators.lowDiversity = true;
        risk += 0.22;
        details.push(`Single dominant source: ${(domRatio * 100).toFixed(0)}%`);
      } else if (domRatio > 0.6) {
        risk += 0.14;
      }

      if (hhi > 0.55) {
        risk += 0.12;
        details.push(`High source concentration (HHI: ${hhi.toFixed(2)})`);
      }

      risk += 0.20 * Math.max(0, 0.55 - diversity);

      // Network spillover pattern
      if (domRatio > 0.7 && repostiness > 0.65 && burstScore > 0.35 && originalityScore < 0.45) {
        risk += 0.18;
        details.push('Network spillover pattern detected');
      }
    }

    // ========== 12. Cross-reuse ==========
    const reuseScore = Number(metrics.reuseScore || 0);
    if (reuseScore > 0.3) {
      indicators.crossReuse = true;
      risk += 0.30 * reuseScore;
      details.push(`Cross-channel reuse: ${(reuseScore * 100).toFixed(0)}%`);
    }
    if (reuseScore > 0.6 && repostiness > 0.6) {
      risk += 0.15;
      details.push('Synchronized network content detected');
    }

    // ========== 13. High views + low originality ==========
    if ((metrics.medianViews || 0) > 20000 && originalityScore < 0.35) {
      risk += 0.10;
      details.push('High reach with low content originality');
    }

    // Cap and calculate confidence
    const fraudRisk = clamp01(risk);
    const confidence = Math.min(1, posts.length / 30);

    return {
      channelId: channel.channelId,
      username,
      fraudRisk,
      indicators,
      confidence,
      details,
    };
  }

  /**
   * Compute fraud risk for a channel (simplified, for metrics service)
   */
  async computeFraudFor(username: string): Promise<number> {
    const result = await this.analyzeChannel(username);
    return result.fraudRisk;
  }

  /**
   * Batch analyze multiple channels
   */
  async batchAnalyze(usernames: string[]): Promise<Map<string, FraudAnalysisResult>> {
    const results = new Map<string, FraudAnalysisResult>();
    
    for (const username of usernames) {
      const result = await this.analyzeChannel(username);
      results.set(username, result);
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
      const fraudRisk = await this.computeFraudFor(channel.username);
      
      await TgChannelModel.updateOne(
        { username: channel.username },
        { fraudScore: fraudRisk * 100 }
      );
      updated++;
    }

    return { updated };
  }
}

export const advancedFraudService = new AdvancedFraudService();
