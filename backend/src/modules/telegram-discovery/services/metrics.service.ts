/**
 * Advanced Metrics Service
 * 
 * Full metrics collection with all detectors:
 * - Base metrics (views, engagement, growth)
 * - Promo detection
 * - Burst detection
 * - Elasticity analysis
 * - Originality check
 * - Forward composition
 * - Language detection
 * - Topic vectors
 * - Source diversity
 * - Cross-reuse detection
 */
import { TgChannelModel, TgPostModel } from '../models/index.js';
import { TgMetricsModel } from '../models/tg_metrics.model.js';
import { TgCategoryMembershipModel } from '../models/tg_category_membership.model.js';
import { median, variance, clamp01 } from '../utils/math.js';
import { createFingerprint } from '../utils/extract.js';

// Detectors
import { detectPromo } from '../detectors/promo.detector.js';
import { detectBursts } from '../detectors/burst.detector.js';
import { detectElasticity } from '../detectors/elasticity.detector.js';
import { detectOriginality } from '../detectors/originality.detector.js';
import { detectForwardComposition } from '../detectors/forward_composition.detector.js';
import { detectLanguage } from '../detectors/language.detector.js';
import { detectSourceDiversity } from '../detectors/source_diversity.detector.js';
import { detectCrossReuse } from '../detectors/cross_reuse.detector.js';

// Categories
import { classifyChannel } from '../categories/category.engine.js';
import { buildTopicVector, topTopics } from '../categories/topic.engine.js';

export interface CalculateMetricsParams {
  username: string;
  days?: number;
}

class AdvancedMetricsService {
  /**
   * Calculate full metrics for a channel
   */
  async calculateMetrics(params: CalculateMetricsParams): Promise<{
    ok: boolean;
    metrics?: any;
    error?: string;
  }> {
    try {
      const { username, days = 30 } = params;
      const timestamp = this.getHourlyBucket(new Date());

      // Get channel
      const channel = await TgChannelModel.findOne({ username }).lean();
      if (!channel) {
        return { ok: false, error: 'Channel not found' };
      }

      // Get posts for the period
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const posts = await TgPostModel
        .find({ channelUsername: username, postedAt: { $gte: since } })
        .sort({ postedAt: -1 })
        .lean();

      if (posts.length < 3) {
        return { ok: false, error: 'Insufficient posts for analysis' };
      }

      // ========== BASE METRICS ==========
      const views = posts.map(p => p.views || 0).filter(v => v > 0);
      const forwards = posts.map(p => p.forwards || 0);
      const replies = posts.map(p => p.replies || 0);
      
      const totalViews = views.reduce((a, b) => a + b, 0);
      const avgViews = totalViews / (views.length || 1);
      const medianViews = median(views);
      const maxViews = Math.max(...views, 0);
      
      const postsPerDay = posts.length / days;
      
      // Engagement rates
      const totalForwards = forwards.reduce((a, b) => a + b, 0);
      const totalReplies = replies.reduce((a, b) => a + b, 0);
      const forwardRate = totalViews > 0 ? totalForwards / totalViews : 0;
      const replyRate = totalViews > 0 ? totalReplies / totalViews : 0;
      const engagementRate = channel.subscriberCount 
        ? avgViews / channel.subscriberCount 
        : 0;

      // View distribution
      const viewDispersion = views.length > 0 
        ? Math.sqrt(variance(views)) / (avgViews || 1) 
        : 0;
      const spikeRatio = medianViews > 0 ? maxViews / medianViews : 0;

      // ========== DETECTORS ==========
      
      // Promo detection
      const promo = detectPromo(posts.map(p => ({ 
        text: p.text, 
        mentions: p.mentions 
      })));

      // Burst detection
      const burst = detectBursts(posts.map(p => ({ 
        date: p.postedAt, 
        views: p.views, 
        forwards: p.forwards 
      })));

      // Elasticity
      const elast = detectElasticity(posts.map(p => ({ 
        views: p.views, 
        forwards: p.forwards 
      })));

      // Originality
      const orig = detectOriginality(posts.map(p => ({ text: p.text })));

      // Forward composition
      const forwardComp = detectForwardComposition(posts.map(p => ({ 
        forwardedFrom: p.forwardedFrom, 
        views: p.views 
      })));

      // Language
      const lang = detectLanguage(posts.slice(0, 40).map(p => p.text || ''));

      // Source diversity
      const srcDiv = detectSourceDiversity(posts.map(p => ({ 
        forwardedFrom: p.forwardedFrom 
      })));

      // Cross-reuse
      const reuse = await detectCrossReuse(username, TgPostModel, 6);

      // ========== CATEGORIES & TOPICS ==========
      const textsForClassify = [
        channel.description || '',
        ...posts.slice(0, 40).map(p => p.text || ''),
      ].filter(Boolean);

      const categories = classifyChannel(textsForClassify);
      const topicVec = buildTopicVector(textsForClassify);
      const topTopicsList = topTopics(topicVec, 3).map(x => `${x.key}:${x.score.toFixed(2)}`);

      // Save category memberships
      for (const cat of categories) {
        await TgCategoryMembershipModel.findOneAndUpdate(
          { username, category: cat.category },
          { 
            method: 'RULES', 
            confidence: cat.confidence,
            updatedAt: new Date(),
          },
          { upsert: true }
        );
      }

      // ========== SAVE METRICS ==========
      const metricsData = {
        channelId: channel.channelId,
        username,
        timestamp,
        
        // Base
        subscriberCount: channel.subscriberCount || 0,
        subscriberDelta: 0, // TODO: calculate from previous
        postsCount: posts.length,
        totalViews,
        avgViews,
        medianViews,
        maxViews,
        postsPerDay,
        
        // Engagement
        forwardRate,
        replyRate,
        engagementRate,
        growthRate: 0, // TODO
        
        // Distribution
        viewDispersion,
        spikeRatio,
        
        // Promo
        promoDensity: promo.promoDensity,
        linkBlockRatio: promo.linkBlockRatio,
        promoScore: promo.promoScore,
        
        // Burst
        burstScore: burst.burstScore,
        peakClusterRatio: burst.peakClusterRatio,
        maxClusterLen: burst.maxClusterLen,
        
        // Elasticity
        elasticityScore: elast.elasticityScore,
        elasticLowQ: elast.lowQ,
        elasticMidQ: elast.midQ,
        elasticHighQ: elast.highQ,
        
        // Originality
        duplicateRatio: orig.duplicateRatio,
        originalityScore: orig.originalityScore,
        
        // Forward composition
        forwardedPostRatio: forwardComp.forwardedPostRatio,
        forwardedViewsRatio: forwardComp.forwardedViewsRatio,
        repostinessScore: forwardComp.repostinessScore,
        
        // Language
        language: lang.language,
        langRuScore: lang.ruScore,
        langUaScore: lang.uaScore,
        langEnScore: lang.enScore,
        
        // Topics
        topicVector: topicVec,
        topTopics: topTopicsList,
        
        // Source diversity
        forwardedTotal: srcDiv.forwardedTotal,
        uniqueForwardSources: srcDiv.uniqueSources,
        dominantForwardSource: srcDiv.dominantSource,
        dominantSourceRatio: srcDiv.dominantSourceRatio,
        sourceHHI: srcDiv.sourceHHI,
        diversityScore: srcDiv.diversityScore,
        topForwardSources: srcDiv.topSources.map(x => `${x.source}:${x.share.toFixed(2)}`),
        
        // Cross-reuse
        reuseRatio: reuse.reuseRatio,
        reuseClusterCount: reuse.reuseClusterCount,
        maxReuseClusterSize: reuse.maxClusterSize,
        reuseScore: reuse.reuseScore,
        
        computedAt: new Date(),
      };

      await TgMetricsModel.findOneAndUpdate(
        { username, timestamp },
        metricsData,
        { upsert: true, new: true }
      );

      // Update channel with latest metrics
      await TgChannelModel.updateOne(
        { username },
        {
          subscriberCount: channel.subscriberCount,
          avgPostViews: avgViews,
          avgEngagement: engagementRate,
          lastChecked: new Date(),
        }
      );

      return { ok: true, metrics: metricsData };
    } catch (error) {
      console.error('[Metrics] Calculate error:', error);
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Update fingerprints for posts (for cross-reuse detection)
   */
  async updatePostFingerprints(username: string): Promise<number> {
    const posts = await TgPostModel
      .find({ channelUsername: username, fingerprint: { $exists: false } })
      .lean();

    let updated = 0;
    for (const post of posts) {
      const fp = createFingerprint(post.text || '');
      if (fp) {
        await TgPostModel.updateOne(
          { _id: post._id },
          { fingerprint: fp }
        );
        updated++;
      }
    }

    return updated;
  }

  /**
   * Get metrics history for a channel
   */
  async getMetricsHistory(username: string, days: number = 7): Promise<any[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metrics = await TgMetricsModel
      .find({ username, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .lean();

    return metrics;
  }

  /**
   * Build metrics for all active channels
   */
  async buildDailyMetrics(days: number = 30): Promise<{ processed: number; errors: number }> {
    const channels = await TgChannelModel.find({ status: 'active' }).lean();
    let processed = 0;
    let errors = 0;

    for (const channel of channels) {
      try {
        // Update fingerprints first
        await this.updatePostFingerprints(channel.username);
        
        // Calculate metrics
        const result = await this.calculateMetrics({ 
          username: channel.username, 
          days 
        });
        
        if (result.ok) {
          processed++;
        } else {
          errors++;
          console.error(`[Metrics] Error for ${channel.username}: ${result.error}`);
        }
      } catch (e) {
        errors++;
        console.error(`[Metrics] Exception for ${channel.username}:`, e);
      }
    }

    return { processed, errors };
  }

  private getHourlyBucket(date: Date): Date {
    const bucket = new Date(date);
    bucket.setMinutes(0, 0, 0);
    return bucket;
  }
}

export const advancedMetricsService = new AdvancedMetricsService();
