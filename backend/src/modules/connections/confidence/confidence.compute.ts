/**
 * Confidence Compute
 * 
 * Calculate confidence score with Twitter coverage and graph availability.
 */

export interface ConfidenceFactors {
  base_score: number;           // 0-1
  data_freshness: number;       // 0-1
  coverage_authors: number;     // 0-1
  coverage_engagements: number; // 0-1
  graph_available: boolean;
  twitter_connected: boolean;
}

export interface ConfidenceResult {
  score: number;
  capped: boolean;
  cap_value?: number;
  cap_reason?: string;
  factors: ConfidenceFactors;
  breakdown: {
    base: number;
    freshness_bonus: number;
    coverage_bonus: number;
    graph_penalty: number;
    twitter_bonus: number;
  };
}

const GRAPH_MISSING_CAP = 0.75;    // Max confidence without graph
const TWITTER_BONUS = 0.1;         // Bonus for Twitter connection
const FRESHNESS_WEIGHT = 0.15;     // Weight for freshness factor
const COVERAGE_WEIGHT = 0.2;       // Weight for coverage factor

/**
 * Compute confidence score
 */
export function computeConfidence(factors: ConfidenceFactors): ConfidenceResult {
  const breakdown = {
    base: factors.base_score,
    freshness_bonus: factors.data_freshness * FRESHNESS_WEIGHT,
    coverage_bonus: ((factors.coverage_authors + factors.coverage_engagements) / 2) * COVERAGE_WEIGHT,
    graph_penalty: factors.graph_available ? 0 : -0.1,
    twitter_bonus: factors.twitter_connected ? TWITTER_BONUS : 0,
  };

  let score = breakdown.base + breakdown.freshness_bonus + breakdown.coverage_bonus + breakdown.graph_penalty + breakdown.twitter_bonus;
  score = Math.max(0, Math.min(1, score));

  // Apply cap if graph is missing
  const capped = !factors.graph_available && score > GRAPH_MISSING_CAP;
  if (capped) {
    score = GRAPH_MISSING_CAP;
  }

  return {
    score,
    capped,
    cap_value: capped ? GRAPH_MISSING_CAP : undefined,
    cap_reason: capped ? 'Graph data not available - confidence capped at 0.75' : undefined,
    factors,
    breakdown,
  };
}

/**
 * Get confidence for Twitter adapter mode
 */
export function getTwitterAdapterConfidence(
  hasData: boolean,
  authorCount: number,
  engagementCount: number,
  freshnessHours: number
): ConfidenceResult {
  const factors: ConfidenceFactors = {
    base_score: 0.5,
    data_freshness: freshnessHours < 24 ? 1 : freshnessHours < 72 ? 0.7 : freshnessHours < 168 ? 0.4 : 0.1,
    coverage_authors: Math.min(1, authorCount / 50),
    coverage_engagements: Math.min(1, engagementCount / 200),
    graph_available: false,  // Always false for now
    twitter_connected: hasData,
  };

  return computeConfidence(factors);
}

/**
 * Get confidence status label
 */
export function getConfidenceLabel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
  if (score < 0.3) return 'LOW';
  if (score < 0.5) return 'MEDIUM';
  if (score < 0.75) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * Check if confidence meets threshold
 */
export function meetsConfidenceThreshold(score: number, threshold: number = 0.7): boolean {
  return score >= threshold;
}
