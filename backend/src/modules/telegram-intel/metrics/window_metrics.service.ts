/**
 * Window Metrics Service
 * 
 * Computes metrics for 7d/30d/90d windows
 */
import { TgPostModel } from '../models_compat/tg.post.model.js';
import { TgMetricsWindowModel } from '../models/tg.metrics_window.model.js';

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function std(arr: number[]): number {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(p * (s.length - 1));
  return s[idx] || 0;
}

export class WindowMetricsService {
  async compute(username: string, window: '7d' | '30d' | '90d'): Promise<void> {
    const days = parseInt(window);
    const since = new Date(Date.now() - days * 86400000);

    const posts = await TgPostModel.find({
      channelUsername: username,
      postedAt: { $gte: since },
    }).lean();

    if (!posts.length) return;

    const views = posts.map((p) => p.views || 0);
    const forwards = posts.map((p) => p.forwards || 0);
    const replies = posts.map((p) => p.replies || 0);

    const medianViews = median(views);
    const p90Views = percentile(views, 0.9);
    const viewDispersion = medianViews > 0 ? std(views) / medianViews : 0;

    const totalViews = views.reduce((a, b) => a + b, 0);
    const totalForwards = forwards.reduce((a, b) => a + b, 0);
    const totalReplies = replies.reduce((a, b) => a + b, 0);

    const forwardRate = totalViews > 0 ? totalForwards / totalViews : 0;
    const replyRate = totalViews > 0 ? totalReplies / totalViews : 0;

    const postsPerDay = posts.length / days;

    const activeDays = new Set(
      posts.map((p) => new Date(p.postedAt).toISOString().slice(0, 10))
    ).size;
    const activeDaysRatio = activeDays / days;

    // Calculate view growth slope (simple linear regression)
    const sortedPosts = [...posts].sort(
      (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime()
    );
    let viewGrowthSlope = 0;
    if (sortedPosts.length >= 3) {
      const half = Math.floor(sortedPosts.length / 2);
      const firstHalf = sortedPosts.slice(0, half);
      const secondHalf = sortedPosts.slice(half);
      const avgFirst = firstHalf.reduce((s, p) => s + (p.views || 0), 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, p) => s + (p.views || 0), 0) / secondHalf.length;
      viewGrowthSlope = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0;
    }

    await TgMetricsWindowModel.updateOne(
      { username, window },
      {
        $set: {
          postsCount: posts.length,
          postsPerDay,
          activeDaysRatio,

          medianViews,
          p90Views,
          viewDispersion,
          viewGrowthSlope,

          forwardRate,
          replyRate,

          computedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  async computeAll(username: string): Promise<void> {
    await this.compute(username, '7d');
    await this.compute(username, '30d');
    await this.compute(username, '90d');
  }
}
