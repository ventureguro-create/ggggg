/**
 * Explain Service
 * Phase 4: Human-readable explanations
 */
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { TgAlphaScoreModel } from '../models/tg.alpha_score.model.js';
import { TgCredibilityModel } from '../models/tg.credibility.model.js';
import { TgFraudSignalModel } from '../models/tg.fraud_signal.model.js';
import { TgOverridesModel } from '../governance/governance.model.js';

export class ExplainService {
  async explain(username: string) {
    const u = username.toLowerCase();

    const intel = await TgIntelRankingModel.findOne({ username: u }).lean();
    if (!intel) return { ok: false, error: 'intel_not_found' };

    const alpha = await TgAlphaScoreModel.findOne({ username: u }).lean();
    const cred = await TgCredibilityModel.findOne({ username: u }).lean();
    const fraud = await TgFraudSignalModel.findOne({ username: u }).lean();
    const ov = await TgOverridesModel.findOne({ username: u }).lean();

    const bullets: string[] = [];

    bullets.push(
      `IntelScore: ${Number((intel as any).intelScore).toFixed(1)} (${(intel as any).tier})`
    );

    bullets.push(
      `BaseScore: ${Number((intel as any).components?.baseScore ?? 0).toFixed(1)} — reach/activity/engagement с anti-fraud.`
    );

    bullets.push(
      `AlphaScore: ${Number((intel as any).components?.alphaScore ?? 0).toFixed(1)} — performance по упоминаниям токенов (ROI после mention).`
    );

    bullets.push(
      `Credibility: ${Number((intel as any).components?.credibilityScore ?? 0).toFixed(1)} (${(cred as any)?.tier ?? 'N/A'}) — reliability, recency, stability.`
    );

    const fr = Number((intel as any).components?.fraudRisk ?? 0);
    bullets.push(
      `FraudRisk: ${fr.toFixed(2)} — penalty применён: ${(Number((intel as any).penalties?.fraudPenalty ?? 0) * 100).toFixed(0)}%.`
    );

    if (Number((intel as any).penalties?.lowCredPenalty ?? 0) > 0.15) {
      bullets.push(`Penalty: низкий credibility уменьшает влияние alpha.`);
    }
    if (Number((intel as any).penalties?.lowSamplePenalty ?? 0) > 0.1) {
      bullets.push(`Penalty: мало статистики по alpha (low sample).`);
    }

    if ((ov as any)?.status === 'ALLOWLIST') {
      bullets.push(`Governance: ALLOWLIST (ручное доверие).`);
    }
    if ((ov as any)?.status === 'BLOCKLIST') {
      bullets.push(`Governance: BLOCKLIST (ручной запрет).`);
    }
    if ((ov as any)?.forcedTier) {
      bullets.push(`Governance: forcedTier=${(ov as any).forcedTier}.`);
    }
    if ((ov as any)?.forcedScore != null) {
      bullets.push(`Governance: forcedScore=${(ov as any).forcedScore}.`);
    }

    return {
      ok: true,
      username: u,
      snapshot: { intel, alpha, cred, fraud, override: ov || null },
      explanation: bullets,
    };
  }
}
