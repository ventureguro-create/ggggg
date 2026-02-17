/**
 * Facet Score Formulas
 * Rule-based scoring for different facets
 */

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export interface FacetScoreInput {
  // Core scores
  smart?: number;           // smart follower ratio
  authority?: number;       // authority v3
  influence?: number;       // influence score
  audienceQuality?: number; // audience quality
  engagement?: number;      // engagement rate
  reach?: number;           // reach proxy
  trendAccel?: number;      // trend acceleration
  anchorProximity?: number; // proximity to anchors
  size?: number;            // normalized size (0..1)
  mediaScore?: number;      // media coverage
  onchainScore?: number;    // onchain activity
  botRisk?: number;         // bot/spam risk
  confidence?: number;      // data confidence
  searchScore?: number;     // search popularity
}

export interface FacetScores {
  SMART: number;
  INFLUENCE: number;
  EARLY: number;
  VC: number;
  MEDIA: number;
  NFT: number;
  TRENDING: number;
  MOST_SEARCHED: number;
  POPULAR: number;
}

/**
 * SMART Score
 * SmartScore = 0.55*smart_followers + 0.25*authority + 0.20*audience_quality
 */
export function smartScore(input: FacetScoreInput): number {
  return clamp01(
    0.55 * clamp01(input.smart ?? 0) +
    0.25 * clamp01(input.authority ?? 0) +
    0.20 * clamp01(input.audienceQuality ?? 0)
  );
}

/**
 * INFLUENCE Score
 * InfluenceScore = 0.45*authority + 0.35*engagement_velocity + 0.20*reach
 */
export function influenceScore(input: FacetScoreInput): number {
  return clamp01(
    0.45 * clamp01(input.authority ?? input.influence ?? 0) +
    0.35 * clamp01(input.engagement ?? 0) +
    0.20 * clamp01(input.reach ?? input.size ?? 0)
  );
}

/**
 * EARLY Score (Early Projects)
 * EarlyScore = 0.40*trend_accel + 0.30*smart + 0.20*anchor_proximity + 0.10*(1-size)
 */
export function earlyScore(input: FacetScoreInput): number {
  return clamp01(
    0.40 * clamp01(input.trendAccel ?? input.engagement ?? 0) +
    0.30 * clamp01(input.smart ?? 0) +
    0.20 * clamp01(input.anchorProximity ?? 0) +
    0.10 * (1 - clamp01(input.size ?? 0.5))
  );
}

/**
 * VC Score (Funds & VCs)
 * VCScore = seed_authority (from backers) + optional onchain/media
 */
export function vcScore(input: FacetScoreInput): number {
  return clamp01(
    0.70 * clamp01(input.authority ?? 0) +
    0.15 * clamp01(input.onchainScore ?? 0) +
    0.15 * clamp01(input.mediaScore ?? 0)
  );
}

/**
 * MEDIA Score
 * MediaScore = media_score + coverage_breadth
 */
export function mediaScore(input: FacetScoreInput): number {
  return clamp01(
    0.60 * clamp01(input.mediaScore ?? 0) +
    0.25 * clamp01(input.influence ?? 0) +
    0.15 * clamp01(input.reach ?? 0)
  );
}

/**
 * NFT Score
 * Based on tags, categories, follow clusters
 */
export function nftScore(input: FacetScoreInput): number {
  // Simplified - would need tag classifier in production
  return clamp01(
    0.50 * clamp01(input.influence ?? 0) +
    0.30 * clamp01(input.engagement ?? 0) +
    0.20 * clamp01(input.smart ?? 0)
  );
}

/**
 * TRENDING Score
 * TrendingScore = trend_accel + engagement_spike + velocity
 */
export function trendingScore(input: FacetScoreInput): number {
  return clamp01(
    0.50 * clamp01(input.trendAccel ?? input.engagement ?? 0) +
    0.30 * clamp01(input.engagement ?? 0) +
    0.20 * clamp01(input.reach ?? 0)
  );
}

/**
 * MOST_SEARCHED Score
 * Placeholder - needs search provider integration
 */
export function mostSearchedScore(input: FacetScoreInput): number {
  return clamp01(input.searchScore ?? 0);
}

/**
 * POPULAR Score (Popular Projects)
 * PopularScore = size + media + engagement + authority
 */
export function popularScore(input: FacetScoreInput): number {
  return clamp01(
    0.35 * clamp01(input.size ?? 0) +
    0.25 * clamp01(input.mediaScore ?? 0) +
    0.20 * clamp01(input.engagement ?? 0) +
    0.20 * clamp01(input.authority ?? 0)
  );
}

/**
 * Calculate all facet scores for an account
 */
export function calculateAllFacetScores(input: FacetScoreInput): FacetScores {
  return {
    SMART: smartScore(input),
    INFLUENCE: influenceScore(input),
    EARLY: earlyScore(input),
    VC: vcScore(input),
    MEDIA: mediaScore(input),
    NFT: nftScore(input),
    TRENDING: trendingScore(input),
    MOST_SEARCHED: mostSearchedScore(input),
    POPULAR: popularScore(input),
  };
}
