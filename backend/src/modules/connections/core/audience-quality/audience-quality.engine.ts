/**
 * Audience Quality Engine v1.0
 * 
 * Main computation logic for audience quality assessment.
 * Works with proxy signals now, ready for Twitter data later.
 */

import type { 
  AudienceQualityInput, 
  AudienceQualityResult, 
  ConfidenceLevel 
} from "../../contracts/audience-quality.contracts.js";
import { audienceQualityConfig as cfg, AUDIENCE_QUALITY_VERSION } from "./audience-quality.config.js";
import { 
  norm01, 
  clamp01,
  computeOverlapPressure01, 
  computeBotRisk01, 
  computePurity01, 
  computeSmartFollowersProxy01,
  computeSignalQuality01
} from "./audience-quality.math.js";
import { explainAudienceQuality } from "./audience-quality.explain.js";

/**
 * Compute confidence level based on available data
 */
function computeConfidence(input: AudienceQualityInput): ConfidenceLevel {
  const samples = input.overlap?.sample_size ?? 0;
  const hasCore = input.x_score != null && input.signal_noise != null;

  if (hasCore && samples >= cfg.confidence.min_overlap_samples_for_high) {
    return "HIGH";
  }
  if (hasCore && samples >= cfg.confidence.min_overlap_samples_for_med) {
    return "MED";
  }
  if (hasCore) {
    return "MED"; // core metrics exist, overlap missing
  }
  return "LOW";
}

/**
 * Main audience quality computation
 */
export function computeAudienceQuality(input: AudienceQualityInput): AudienceQualityResult {
  // Normalize inputs
  const xScore01 = norm01(input.x_score ?? 0, cfg.normalize.x_score_max);
  const signalNoise01 = norm01(input.signal_noise ?? 5, cfg.normalize.signal_noise_max);
  const consistency01 = clamp01(input.consistency_0_1 ?? 0.55);

  // Compute proxy signals
  const overlapPressure01 = computeOverlapPressure01(input.overlap);
  const botRisk01 = computeBotRisk01(input.red_flags ?? []);
  const purity01 = computePurity01(overlapPressure01, botRisk01);
  const smartProxy01 = computeSmartFollowersProxy01(xScore01, signalNoise01, purity01);
  const signalQuality01 = computeSignalQuality01(xScore01, signalNoise01);

  // Final audience quality score (weighted sum)
  const w = cfg.weights;
  const score01 =
    w.purity * purity01 +
    w.smart_followers_proxy * smartProxy01 +
    w.signal_quality * signalQuality01 +
    w.consistency * consistency01;

  const confidence = computeConfidence(input);

  // Bot share aligns with bot risk
  const botShare01 = clamp01(botRisk01);

  // Tier1 and top followers are neutral until Twitter data
  const tier1Share01 = cfg.neutral.tier1_share_0_1;
  const topFollowersCount = cfg.neutral.top_followers_count;

  // Build evidence notes
  const notes: string[] = [];
  const inputsUsed: string[] = [];

  if (input.x_score != null) inputsUsed.push("x_score");
  if (input.signal_noise != null) inputsUsed.push("signal_noise");
  if (input.consistency_0_1 != null) inputsUsed.push("consistency");
  if (input.red_flags?.length) inputsUsed.push("red_flags");
  if (input.overlap) inputsUsed.push("overlap");

  if (!input.overlap) {
    notes.push("Overlap data not available: using neutral overlap pressure estimate.");
  }
  if ((input.overlap?.sample_size ?? 0) === 0) {
    notes.push("No sample_size for overlap: confidence may be limited.");
  }
  if ((input.red_flags ?? []).length === 0) {
    notes.push("No red flags provided: bot risk may be underestimated.");
  }
  if (confidence === "LOW") {
    notes.push("Limited data available: results are approximate.");
  }

  // Build result
  const result: AudienceQualityResult = {
    account_id: input.account_id,

    audience_quality_score_0_1: clamp01(score01),

    smart_followers_score_0_1: clamp01(smartProxy01),
    top_followers_count: topFollowersCount,
    tier1_share_0_1: clamp01(tier1Share01),
    bot_share_0_1: clamp01(botShare01),
    audience_purity_score_0_1: clamp01(purity01),

    confidence,

    evidence: {
      overlap_pressure_0_1: clamp01(overlapPressure01),
      bot_risk_0_1: clamp01(botRisk01),
      purity_0_1: clamp01(purity01),
      smart_followers_proxy_0_1: clamp01(smartProxy01),
      inputs_used: inputsUsed,
      notes,
    },

    explain: {
      summary: "",
      drivers: [],
      concerns: [],
      recommendations: [],
    },

    meta: {
      version: AUDIENCE_QUALITY_VERSION,
      computed_at: new Date().toISOString(),
      data_mode: input.twitter_followers ? "hybrid" : "proxy",
    },
  };

  // Generate explanations
  result.explain = explainAudienceQuality(result);

  return result;
}

/**
 * Batch computation for multiple accounts
 */
export function computeAudienceQualityBatch(inputs: AudienceQualityInput[]): {
  version: string;
  computed_at: string;
  results: AudienceQualityResult[];
  stats: {
    total: number;
    avg_quality: number;
    high_quality_count: number;
    risky_count: number;
  };
} {
  const results = inputs.map(computeAudienceQuality);
  
  let totalQuality = 0;
  let highCount = 0;
  let riskyCount = 0;
  
  for (const r of results) {
    totalQuality += r.audience_quality_score_0_1;
    if (r.audience_quality_score_0_1 >= cfg.quality_thresholds.high) highCount++;
    if (r.audience_quality_score_0_1 < cfg.quality_thresholds.low) riskyCount++;
  }

  return {
    version: AUDIENCE_QUALITY_VERSION,
    computed_at: new Date().toISOString(),
    results,
    stats: {
      total: results.length,
      avg_quality: results.length > 0 ? totalQuality / results.length : 0,
      high_quality_count: highCount,
      risky_count: riskyCount,
    },
  };
}
