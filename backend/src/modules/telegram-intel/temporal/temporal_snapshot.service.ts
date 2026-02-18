/**
 * Temporal Snapshot Service
 * Daily score snapshots for each channel
 */
import { TgScoreSnapshotModel } from '../models/tg.score_snapshot.model.js';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { TgAlphaScoreModel } from '../models/tg.alpha_score.model.js';
import { TgCredibilityModel } from '../models/tg.credibility.model.js';
import { TgFraudSignalModel } from '../models/tg.fraud_signal.model.js';
import { TgNetworkAlphaChannelModel } from '../models/tg.network_alpha_channel.model.js';
import { GovernanceService } from '../governance/governance.service.js';

function dayKeyUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export class TemporalSnapshotService {
  constructor(private log: (msg: string, meta?: any) => void) {}

  async snapshotChannel(username: string, at = new Date()) {
    const u = username.toLowerCase();
    const day = dayKeyUTC(at);

    const gov = new GovernanceService(this.log);
    const cfg = await gov.getActiveConfig('intel_v1');

    const intel = await TgIntelRankingModel.findOne({ username: u }).lean();
    const alpha = await TgAlphaScoreModel.findOne({ username: u }).lean();
    const cred = await TgCredibilityModel.findOne({ username: u }).lean();
    const fraud = await TgFraudSignalModel.findOne({ username: u }).lean();
    const net = await TgNetworkAlphaChannelModel.findOne({ username: u }).lean();

    const doc = {
      username: u,
      day,
      config: { key: cfg.key ?? 'intel_v1', version: cfg.version ?? 1 },

      scores: {
        intelScore: Number((intel as any)?.intelScore ?? 0),
        baseScore: Number((intel as any)?.components?.baseScore ?? 0),
        alphaScore: Number((alpha as any)?.alphaScore ?? 0),
        credibilityScore: Number((cred as any)?.credibilityScore ?? 0),
        networkAlphaScore: Number((net as any)?.networkAlphaScore ?? 0),
        fraudRisk: Number(
          (fraud as any)?.fraudRisk ??
            (intel as any)?.components?.fraudRisk ??
            0
        ),
      },

      tiers: {
        intelTier: String((intel as any)?.tier ?? 'D'),
        credibilityTier: String((cred as any)?.tier ?? 'D'),
        networkAlphaTier: String((net as any)?.tier ?? 'D'),
      },

      meta: {
        computedAt: new Date(),
        hasIntel: !!intel,
        hasAlpha: !!alpha,
        hasCred: !!cred,
        hasNet: !!net,
      },
    };

    await TgScoreSnapshotModel.updateOne(
      { username: u, day },
      { $set: doc },
      { upsert: true }
    );

    return { ok: true, username: u, day };
  }

  /**
   * Batch snapshot for all channels with scores
   */
  async snapshotBatch(limit = 500) {
    // Get all channels that have intel scores
    const channels = await TgIntelRankingModel.find({})
      .select('username')
      .limit(Math.max(1, Math.min(10000, limit)))
      .lean();

    let done = 0;
    for (const ch of channels) {
      try {
        await this.snapshotChannel(String((ch as any).username));
        done++;
      } catch (e: any) {
        this.log('[temporal] snapshot error', {
          username: (ch as any).username,
          err: String(e?.message || e),
        });
      }
    }

    this.log('[temporal] snapshot done', { done });
    return { ok: true, done };
  }
}
