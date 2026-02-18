/**
 * Fraud Snapshot Service
 * 
 * Computes fraud signals and stores breakdown
 */
import { TgMetricsWindowModel } from '../models/tg.metrics_window.model.js';
import { TgFraudSignalModel } from '../models/tg.fraud_signal.model.js';
import { TgChannelModel } from '../models_compat/tg.channel.model.js';
import { TgPostModel } from '../models_compat/tg.post.model.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function shannonEntropy(arr: number[]): number {
  if (!arr.length) return 0;
  const total = arr.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const probs = arr.map((v) => v / total);
  return -probs.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
}

export class FraudSnapshotService {
  async compute(username: string): Promise<number> {
    const m = await TgMetricsWindowModel.findOne({ username, window: '30d' }).lean();
    const channel = await TgChannelModel.findOne({ username }).lean();
    
    if (!m) return 0;

    const signals: Record<string, number> = {};
    let risk = 0;

    // 1. View dispersion anomaly
    if ((m.viewDispersion as number) < 0.05) {
      signals.lowDispersion = 0.2;
      risk += 0.2;
    }

    // 2. Low engagement with high views
    if ((m.forwardRate as number) < 0.002 && (m.medianViews as number) > 20000) {
      signals.lowEngagement = 0.25;
      risk += 0.25;
    }

    // 3. Low activity ratio
    if ((m.activeDaysRatio as number) < 0.2) {
      signals.irregularPosting = 0.15;
      risk += 0.15;
    }

    // 4. Subscriber efficiency (if available)
    if (channel?.subscriberCount && m.medianViews) {
      const efficiency = (m.medianViews as number) / (channel.subscriberCount as number);
      if (efficiency < 0.01) {
        signals.lowEfficiency = 0.2;
        risk += 0.2;
      }
      if (efficiency > 0.9) {
        signals.suspiciousEfficiency = 0.3;
        risk += 0.3;
      }
      signals.subscriberEfficiency = efficiency;
    }

    // 5. View entropy (needs posts)
    const since = new Date(Date.now() - 30 * 86400000);
    const posts = await TgPostModel.find({
      channelUsername: username,
      postedAt: { $gte: since },
    })
      .select('views')
      .lean();

    if (posts.length >= 10) {
      const views = posts.map((p) => p.views || 0);
      const entropy = shannonEntropy(views);
      signals.entropy = entropy;
      
      if (entropy < 2.5) {
        signals.lowEntropy = 0.2;
        risk += 0.2;
      }
    }

    // 6. Spike ratio
    if (m.p90Views && m.medianViews && (m.medianViews as number) > 0) {
      const spikeRatio = (m.p90Views as number) / (m.medianViews as number);
      signals.spikeRatio = spikeRatio;
      
      if (spikeRatio > 5 && (m.forwardRate as number) < 0.01) {
        signals.spikeAnomaly = 0.2;
        risk += 0.2;
      }
    }

    risk = clamp01(risk);

    await TgFraudSignalModel.updateOne(
      { username },
      {
        $set: {
          fraudRisk: risk,
          entropy: signals.entropy || null,
          elasticity: m.forwardRate,
          spikeRatio: signals.spikeRatio || null,
          subscriberEfficiency: signals.subscriberEfficiency || null,
          signals,
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return risk;
  }
}
