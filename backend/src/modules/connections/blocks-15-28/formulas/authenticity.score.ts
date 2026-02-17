/**
 * BLOCK 21 - Influencer Authenticity Score (IAS)
 * 
 * Single metric for audience authenticity
 * IAS = 0.45 × RealFollowerRatio + 0.35 × AudienceQuality + 0.20 × NetworkIntegrity
 */

export type AuthenticityLabel = 
  | 'ORGANIC' 
  | 'MOSTLY_REAL' 
  | 'MIXED' 
  | 'FARMED' 
  | 'HIGHLY_FARMED';

/**
 * Calculate Influencer Authenticity Score
 */
export function influencerAuthenticityScore(args: {
  realFollowerRatio: number;  // 0-100
  audienceQuality: number;    // 0-100
  networkIntegrity: number;   // 0-100
}): number {
  return Math.round(
    0.45 * args.realFollowerRatio +
    0.35 * args.audienceQuality +
    0.20 * args.networkIntegrity
  );
}

/**
 * Get authenticity label from score
 */
export function authenticityLabel(score: number): AuthenticityLabel {
  if (score >= 80) return 'ORGANIC';
  if (score >= 60) return 'MOSTLY_REAL';
  if (score >= 40) return 'MIXED';
  if (score >= 20) return 'FARMED';
  return 'HIGHLY_FARMED';
}
