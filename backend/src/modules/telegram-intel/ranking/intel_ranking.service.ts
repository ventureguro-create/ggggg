/**
 * Intel Ranking Service
 * Phase 3 Step 5 + 4.2: Unified Intelligence Score with NetworkAlpha
 *
 * Combines: BaseScore + AlphaScore + CredibilityScore + NetworkAlphaScore + FraudRisk
 * With governance overrides applied
 */
import { TgAlphaScoreModel } from '../models/tg.alpha_score.model.js';
import { TgCredibilityModel } from '../models/tg.credibility.model.js';
import { TgFraudSignalModel } from '../models/tg.fraud_signal.model.js';
import { TgMetricsWindowModel } from '../models/tg.metrics_window.model.js';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { TgNetworkAlphaChannelModel } from '../models/tg.network_alpha_channel.model.js';
import { GovernanceService } from '../governance/governance.service.js';
import { TgOverridesModel } from '../governance/governance.model.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp100(x: number): number {
  return Math.max(0, Math.min(100, x));
}

export class IntelRankingService {
  private gov: GovernanceService;

  constructor(private log: (msg: string, meta?: any) => void) {
    this.gov = new GovernanceService(log);
  }

  async compute(username: string) {
    const u = username.toLowerCase();

    // Load config and override
    const config = await this.gov.getActiveConfig('intel_v1');
    const override = await TgOverridesModel.findOne({ username: u }).lean();

    // BLOCKLIST check
    if ((override as any)?.status === 'BLOCKLIST') {
      return this.storeResult(u, 0, 'D', {
        reason: 'BLOCKLIST',
        override,
      });
    }

    // Load all scores
    const alpha = await TgAlphaScoreModel.findOne({ username: u }).lean();
    const cred = await TgCredibilityModel.findOne({ username: u }).lean();
    const fraud = await TgFraudSignalModel.findOne({ username: u }).lean();
    const m30 = await TgMetricsWindowModel.findOne({ username: u, window: '30d' }).lean();
    const net = await TgNetworkAlphaChannelModel.findOne({ username: u }).lean();

    // Base score from metrics (reach/engagement) - simplified
    const medianViews = Number((m30 as any)?.medianViews ?? 0);
    const forwardRate = Number((m30 as any)?.forwardRate ?? 0);
    const baseScore = clamp100(
      Math.min(100, medianViews / 500) * 0.6 + forwardRate * 100 * 0.4
    );

    let fraudRisk = Number((fraud as any)?.fraudRisk ?? 0);

    // Apply fraud override
    if ((override as any)?.fraudRiskOverride != null) {
      fraudRisk = Number((override as any).fraudRiskOverride);
    }

    const alphaScore = Number((alpha as any)?.alphaScore ?? 0);
    const credibilityScore = Number((cred as any)?.credibilityScore ?? 0);
    const networkAlphaScore = Number((net as any)?.networkAlphaScore ?? 0);

    // Weights from config
    const wBase = config.weights.base;
    const wAlpha = config.weights.alpha;
    const wCred = config.weights.cred;
    const wNet = config.weights.netAlpha ?? 0;

    // Fraud penalty
    const kill = fraudRisk >= config.fraud.killSwitch;
    const fraudPenalty = kill
      ? 0.95
      : Math.max(0, config.fraud.penaltyBase + config.fraud.penaltyScale * fraudRisk);

    // Low credibility penalty
    const lowCredPenalty = Math.max(
      0,
      (config.lowCred.pivot - credibilityScore) / config.lowCred.scale
    );

    // Low sample penalty
    const lowSamplePenalty =
      (alpha as any)?.breakdown?.reason === 'low_sample' ? config.lowSamplePenalty : 0;

    // Low network alpha penalty (optional)
    let lowNetAlphaPenalty = 0;
    if (wNet > 0 && networkAlphaScore > 0) {
      const pivot = config.netAlpha?.lowNetAlphaPivot ?? 25;
      const maxP = config.netAlpha?.lowNetAlphaPenaltyMax ?? 0.08;
      lowNetAlphaPenalty =
        Math.max(0, Math.min(1, (pivot - networkAlphaScore) / pivot)) * maxP;
    }

    // Cred gating alpha: alphaEffective = alpha × (0.35 + 0.65 × cred/100)
    const alphaEffective = alphaScore * (0.35 + 0.65 * (credibilityScore / 100));

    // Cred-gated NetworkAlpha: don't boost garbage channels
    const credGate =
      (config.netAlpha?.credGateBase ?? 0.25) +
      (config.netAlpha?.credGateScale ?? 0.75) * (credibilityScore / 100);
    const networkAlphaEffective = networkAlphaScore * clamp01(credGate);

    // Raw score (now includes networkAlpha)
    const raw =
      wBase * baseScore +
      wAlpha * alphaEffective +
      wCred * credibilityScore +
      wNet * networkAlphaEffective;

    // Combined penalty (updated weights)
    let penaltyCombined =
      0.52 * fraudPenalty +
      0.28 * lowCredPenalty +
      0.12 * lowSamplePenalty +
      0.08 * lowNetAlphaPenalty;

    // Apply penalty multiplier override
    if ((override as any)?.penaltyMultiplier != null) {
      penaltyCombined *= Number((override as any).penaltyMultiplier);
    }
    penaltyCombined = clamp01(penaltyCombined);

    let intelScore = clamp100(raw * (1 - penaltyCombined));

    // ALLOWLIST floor
    if ((override as any)?.status === 'ALLOWLIST') {
      intelScore = Math.max(intelScore, 70);
    }

    // Forced score override
    if ((override as any)?.forcedScore != null) {
      intelScore = Number((override as any).forcedScore);
    }

    // Tier
    const tier =
      (override as any)?.forcedTier ?? this.resolveTier(intelScore, config);

    return this.storeResult(u, intelScore, tier, {
      components: {
        baseScore,
        alphaScore,
        credibilityScore,
        networkAlphaScore,
        fraudRisk,
        reach: medianViews,
        engagement: forwardRate,
      },
      penalties: {
        fraudPenalty,
        lowCredPenalty,
        lowSamplePenalty,
        lowNetAlphaPenalty,
      },
      raw,
      alphaEffective,
      networkAlphaEffective,
      credGate,
      weights: { wBase, wAlpha, wCred, wNet },
      penaltyCombined,
      configKey: config.key,
      configVersion: config.version ?? 1,
      override: override ?? null,
    });
  }

  private resolveTier(score: number, config: any): string {
    const t = config.tiers;
    if (score >= t.S) return 'S';
    if (score >= t.A) return 'A';
    if (score >= t.B) return 'B';
    if (score >= t.C) return 'C';
    return 'D';
  }

  private async storeResult(username: string, intelScore: number, tier: string, explain: any) {
    const doc = {
      username,
      intelScore,
      tier,
      components: explain.components,
      penalties: explain.penalties,
      explain,
      computedAt: new Date(),
    };

    await TgIntelRankingModel.updateOne({ username }, { $set: doc }, { upsert: true });

    this.log('[intel] computed', { username, intelScore: intelScore.toFixed(1), tier });
    return doc;
  }

  /**
   * Batch recompute
   */
  async recomputeBatch(limit = 200) {
    const channels = await TgAlphaScoreModel.find({})
      .sort({ alphaScore: -1 })
      .limit(limit)
      .select('username')
      .lean();

    let done = 0;
    for (const ch of channels) {
      try {
        await this.compute((ch as any).username);
        done++;
      } catch (e: any) {
        this.log('[intel] error', { username: (ch as any).username, err: String(e?.message || e) });
      }
    }

    return { ok: true, done };
  }

  /**
   * Get top channels
   */
  async getTop(opts?: { limit?: number; tier?: string; minScore?: number; maxFraud?: number }) {
    const limit = Math.max(1, Math.min(200, opts?.limit || 50));

    const filter: any = {};
    if (opts?.tier) filter.tier = opts.tier;
    if (opts?.minScore != null) filter.intelScore = { $gte: opts.minScore };
    if (opts?.maxFraud != null) filter['components.fraudRisk'] = { $lte: opts.maxFraud };

    const items = await TgIntelRankingModel.find(filter)
      .sort({ intelScore: -1 })
      .limit(limit)
      .select('-_id -__v')
      .lean();

    return { ok: true, count: items.length, items };
  }

  /**
   * Get channel intel
   */
  async getChannelIntel(username: string) {
    const u = username.toLowerCase();
    const doc = await TgIntelRankingModel.findOne({ username: u }).select('-_id -__v').lean();
    return { ok: !!doc, doc };
  }
}
