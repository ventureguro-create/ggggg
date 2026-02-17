/**
 * Audience Quality Explain
 * 
 * Human-readable explanations for audience quality results.
 */

import type { AudienceQualityResult } from "../../contracts/audience-quality.contracts.js";
import { audienceQualityConfig as cfg } from "./audience-quality.config.js";

export function explainAudienceQuality(r: AudienceQualityResult): {
  summary: string;
  drivers: string[];
  concerns: string[];
  recommendations: string[];
} {
  const drivers: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Positive drivers
  if (r.audience_purity_score_0_1 >= 0.75) {
    drivers.push("Clean audience: low overlap and minimal bot patterns detected.");
  }
  if (r.smart_followers_score_0_1 >= 0.70) {
    drivers.push("Strong 'smart followers' signal (proxy): good signal quality with low noise.");
  }
  if (r.bot_share_0_1 <= 0.25) {
    drivers.push("Low bot risk based on proxy signals.");
  }
  if (r.audience_purity_score_0_1 >= 0.60 && r.smart_followers_score_0_1 >= 0.60) {
    drivers.push("Balanced audience profile: both purity and quality are solid.");
  }

  // Concerns
  if (r.audience_purity_score_0_1 <= 0.45) {
    concerns.push("High overlap detected: possible audience spillover between accounts.");
  }
  if (r.bot_share_0_1 >= 0.50) {
    concerns.push("High bot risk from red flags patterns.");
  }
  if (r.confidence === "LOW") {
    concerns.push("Low confidence: insufficient data/comparisons for accurate assessment.");
  }
  if (r.evidence.overlap_pressure_0_1 >= 0.50) {
    concerns.push("Significant audience overlap pressure detected.");
  }

  // Recommendations
  if (r.confidence !== "HIGH") {
    recommendations.push("Connect follower/follow data (Twitter graph) for accurate assessment.");
  }
  if (r.bot_share_0_1 > 0.35) {
    recommendations.push("Review engagement sources: diversify reactions, increase organic interactions.");
  }
  if (r.evidence.overlap_pressure_0_1 > 0.35) {
    recommendations.push("Reduce audience overlap: organic growth, fewer synchronized campaigns.");
  }
  if (r.smart_followers_score_0_1 < 0.50) {
    recommendations.push("Improve content quality to attract higher-quality followers.");
  }

  // Summary based on score
  let summary: string;
  const score = r.audience_quality_score_0_1;
  const thresholds = cfg.quality_thresholds;

  if (score >= 0.80) {
    summary = "Excellent audience quality (proxy) — high trust level, clean and engaged.";
  } else if (score >= thresholds.high) {
    summary = "Good audience quality (proxy) — solid balance of purity and engagement.";
  } else if (score >= thresholds.medium) {
    summary = "Average audience quality (proxy) — some risks or data gaps present.";
  } else if (score >= thresholds.low) {
    summary = "Below average audience (proxy) — notable concerns, verification recommended.";
  } else {
    summary = "Problematic audience (proxy) — high manipulation/overlap indicators or significant uncertainty.";
  }

  return { summary, drivers, concerns, recommendations };
}
