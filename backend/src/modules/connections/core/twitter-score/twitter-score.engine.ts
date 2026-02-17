/**
 * Twitter Score Engine v1.0
 * 
 * Main computation logic for unified Twitter Score.
 * Aggregates existing Connections metrics into 0-1000 score.
 */

import { 
  TwitterScoreInput, 
  TwitterScoreResult, 
  TwitterScoreComponents, 
  Grade, 
  ConfidenceLevel 
} from "../../contracts/twitter-score.contracts.js";
import { twitterScoreConfig as cfg, TWITTER_SCORE_VERSION } from "./twitter-score.config.js";
import { normRange, computeTrend01, computePenalties01, clamp01 } from "./twitter-score.math.js";

/**
 * Pick grade based on score
 */
function pickGrade(score1000: number): Grade {
  for (const g of cfg.grades) {
    if (score1000 >= g.min) return g.grade as Grade;
  }
  return "D";
}

/**
 * Compute confidence level based on available data
 */
function computeConfidence(input: TwitterScoreInput): ConfidenceLevel {
  const has = (k: string) => {
    const val = (input as any)[k];
    return val !== undefined && val !== null;
  };

  const highOk = cfg.confidence.required_for_high.every(has);
  if (highOk) return "HIGH";

  const medOk = cfg.confidence.required_for_med.every(has);
  if (medOk) return "MED";

  return "LOW";
}

/**
 * Generate explain text based on components and results
 */
function generateExplain(
  components: TwitterScoreComponents,
  penalties: { red_flags_penalty: number; risk_penalty: number },
  redFlags: string[],
  confidence: ConfidenceLevel,
  grade: Grade
): { summary: string; drivers: string[]; concerns: string[]; recommendations: string[]; network_explain?: { summary: string; details: string[] } } {
  const drivers: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Positive drivers
  if (components.influence >= 0.75) {
    drivers.push("High base influence (reach/engagement)");
  }
  if (components.quality >= 0.70) {
    drivers.push("Strong profile quality (x_score + signal/noise)");
  }
  if (components.trend >= 0.60) {
    drivers.push("Positive dynamics (growth/acceleration)");
  }
  if (components.network_proxy >= 0.65) {
    drivers.push("Strong network signal (proxy until follower data)");
  }

  // Concerns
  if (penalties.red_flags_penalty + penalties.risk_penalty >= 0.15) {
    concerns.push("Risk factors/anomalies detected in activity patterns");
  }
  if (redFlags.length > 0) {
    const flagsStr = redFlags.slice(0, 3).join(", ");
    concerns.push(`Red flags: ${flagsStr}${redFlags.length > 3 ? "..." : ""}`);
  }
  if (confidence === "LOW") {
    concerns.push("Insufficient data for accurate assessment (confidence LOW)");
  }
  if (components.trend < 0.40) {
    concerns.push("Declining or volatile trend");
  }

  // Recommendations
  if (confidence !== "HIGH") {
    recommendations.push("Connect follower/follow graph for audience quality and handshakes assessment");
  }
  if (penalties.red_flags_penalty > 0) {
    recommendations.push("Reduce engagement anomalies: diversify reactions and organic growth");
  }
  if (components.trend < 0.45) {
    recommendations.push("Improve growth stability: content regularity and quality");
  }
  if (components.influence < 0.40) {
    recommendations.push("Build influence through quality engagement and network expansion");
  }

  // Summary based on grade
  const summaries: Record<Grade, string> = {
    "S": "Top-tier influence and quality. Highly credible account.",
    "A": "Strong account with sustainable influence and good dynamics.",
    "B": "Good account with growth potential through quality/network improvements.",
    "C": "Average level, improvements needed and audience verification recommended.",
    "D": "Low score: high risk or low signal utility.",
  };

  // Phase 3.4.2: Network breakdown explain
  const network_explain = generateNetworkExplain(components);

  return {
    summary: summaries[grade],
    drivers,
    concerns,
    recommendations,
    network_explain,
  };
}

/**
 * Phase 3.4.2: Generate network-specific explanation
 */
function generateNetworkExplain(components: TwitterScoreComponents): { summary: string; details: string[] } {
  const networkSub = components.network_sub;
  const qualitySub = components.quality_sub;
  const details: string[] = [];
  
  // Determine network summary
  let summary = "Network influence assessment";
  const networkScore = components.network_proxy;
  
  if (networkScore >= 0.80) {
    summary = "Elite network embedding — deeply connected to influence core";
  } else if (networkScore >= 0.65) {
    summary = "Strong network position — good access to influential nodes";
  } else if (networkScore >= 0.45) {
    summary = "Moderate network presence — room for expansion";
  } else {
    summary = "Limited network exposure — isolated from influence centers";
  }
  
  // Network sub-component details
  if (networkSub) {
    if (networkSub.audience_quality >= 0.7) {
      details.push("High-quality audience composition");
    } else if (networkSub.audience_quality < 0.4) {
      details.push("Audience quality needs improvement");
    }
    
    if (networkSub.authority_proximity >= 0.7) {
      details.push("Close proximity to authority nodes (few hops to elite)");
    } else if (networkSub.authority_proximity < 0.4) {
      details.push("Distant from authority centers");
    }
    
    if (networkSub.authority_score >= 0.7) {
      details.push("High authority score (PageRank-like centrality)");
    } else if (networkSub.authority_score < 0.4) {
      details.push("Low network centrality");
    }
  }
  
  // Quality sub-component details (smart followers)
  if (qualitySub) {
    if (qualitySub.smart_followers >= 0.7) {
      details.push("Smart followers amplify reach to quality audience");
    } else if (qualitySub.smart_followers < 0.4) {
      details.push("Few smart followers in audience");
    }
  }
  
  // Default detail if none generated
  if (details.length === 0) {
    details.push(`Network score: ${Math.round(networkScore * 100)}%`);
  }
  
  return { summary, details };
}

/**
 * Main Twitter Score computation
 */
export function computeTwitterScore(input: TwitterScoreInput): TwitterScoreResult {
  const baseInfluence = input.base_influence ?? 0;
  const xScore = input.x_score ?? 0;
  const signalNoise = input.signal_noise ?? 5;
  const velocity = input.velocity ?? 0;
  const acceleration = input.acceleration ?? 0;

  const riskLevel = input.risk_level ?? "MED";
  const redFlags = input.red_flags ?? [];

  // Compute components (0..1)
  const influence01 = normRange(baseInfluence, cfg.normalize.influence_max);

  // Phase 3.2: Smart Followers score (quality of followers, not quantity)
  const smartFollowers01 = input.smart_followers_score_0_1 != null
    ? clamp01(input.smart_followers_score_0_1)
    : 0.50; // neutral if not available

  // Quality: x_score + signal_noise + smart_followers
  // Phase 3.2: quality mix = 0.50 engagement + 0.30 consistency_proxy + 0.20 smart_followers
  const qualityBase01 = normRange(xScore, cfg.normalize.quality_max);
  const signalBoost = normRange(signalNoise, cfg.normalize.signal_noise_max);
  const engagementQuality01 = clamp01(0.75 * qualityBase01 + 0.25 * signalBoost);
  
  // Combined quality with smart followers
  const quality01 = clamp01(
    0.50 * engagementQuality01 + 
    0.30 * cfg.proxies.consistency_default +
    0.20 * smartFollowers01
  );

  // Trend from velocity/acceleration
  const trend01 = computeTrend01(velocity, acceleration);

  // Network proxy: use audience_quality if available, else fall back to early signal badge
  // Phase 1.2: audience_quality_score_0_1 replaces network_proxy
  // Phase 1.3: authority_proximity_score_0_1 adds network authority signal
  // Phase 3.1: authority_score_0_1 from Authority Engine (PageRank-like centrality)
  const badge = input.early_signal_badge ?? "none";
  
  const audienceQuality01 = input.audience_quality_score_0_1 != null
    ? clamp01(input.audience_quality_score_0_1)
    : cfg.proxies.network_from_early_signal[badge] ?? 0.5;

  const authorityProximity01 = input.authority_proximity_score_0_1 != null
    ? clamp01(input.authority_proximity_score_0_1)
    : 0.50; // neutral if not available

  // Phase 3.1: Authority Engine score (PageRank-like centrality)
  const authorityScore01 = input.authority_score_0_1 != null
    ? clamp01(input.authority_score_0_1)
    : 0.50; // neutral if not available

  // Combined network component: audience quality + authority proximity + authority score
  // Using weights from authority config: 0.45 audience + 0.30 proximity + 0.25 authority
  const network01 = clamp01(
    0.45 * audienceQuality01 + 
    0.30 * authorityProximity01 + 
    0.25 * authorityScore01
  );

  // Consistency: default proxy (will be replaced by timeseries volatility later)
  const consistency01 = cfg.proxies.consistency_default;

  // Build components object
  const components: TwitterScoreComponents = {
    influence: influence01,
    quality: quality01,
    trend: trend01,
    network_proxy: network01,  // Combined: audience_quality + authority_proximity + authority_score
    consistency: consistency01,
    risk_penalty: 0,
    // Store sub-components for explain layer
    network_sub: {
      audience_quality: audienceQuality01,
      authority_proximity: authorityProximity01,
      authority_score: authorityScore01,
    },
    // Phase 3.2: Quality sub-components
    quality_sub: {
      engagement_quality: engagementQuality01,
      consistency_proxy: cfg.proxies.consistency_default,
      smart_followers: smartFollowers01,
    },
  };

  // Weighted sum
  const w = cfg.weights;
  const base01 =
    w.influence * components.influence +
    w.quality * components.quality +
    w.trend * components.trend +
    w.network_proxy * components.network_proxy +
    w.consistency * components.consistency;

  // Apply penalties
  const p = computePenalties01(riskLevel, redFlags);
  components.risk_penalty = p.total_penalty;

  // Final score
  const final01 = clamp01(base01 * (1 - p.total_penalty));
  const score1000 = Math.round(final01 * 1000);

  const grade = pickGrade(score1000);
  const confidence = computeConfidence(input);

  // Generate explanations
  const explain = generateExplain(components, p, redFlags, confidence, grade);

  return {
    account_id: input.account_id,
    twitter_score_1000: score1000,
    grade,
    confidence,
    components,
    debug: {
      weighted_sum_0_1: base01,
      weights: { ...w },
      penalties: { 
        red_flags_penalty: p.red_flags_penalty, 
        risk_penalty: p.risk_penalty 
      },
    },
    explain,
    meta: {
      version: TWITTER_SCORE_VERSION,
      computed_at: new Date().toISOString(),
      data_sources: [
        "connections_influence",
        "connections_trends",
        "connections_early_signal",
        ...(input.audience_quality ? ["audience_quality"] : []),
        ...(input.network_hops ? ["network_hops"] : []),
      ],
    },
  };
}

/**
 * Batch compute for multiple accounts
 */
export function computeTwitterScoreBatch(inputs: TwitterScoreInput[]): {
  version: string;
  computed_at: string;
  results: TwitterScoreResult[];
  stats: {
    total: number;
    by_grade: Record<Grade, number>;
    avg_score: number;
  };
} {
  const results = inputs.map(computeTwitterScore);
  
  const byGrade: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  let totalScore = 0;
  
  for (const r of results) {
    byGrade[r.grade]++;
    totalScore += r.twitter_score_1000;
  }

  return {
    version: TWITTER_SCORE_VERSION,
    computed_at: new Date().toISOString(),
    results,
    stats: {
      total: results.length,
      by_grade: byGrade,
      avg_score: results.length > 0 ? Math.round(totalScore / results.length) : 0,
    },
  };
}
