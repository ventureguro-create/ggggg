/**
 * Scoring Profiles
 * 
 * Different weight models for different account sizes.
 * Same math, different emphasis.
 * 
 * - retail: small accounts, quality over reach
 * - influencer: balanced mid-size
 * - whale: large accounts, reach matters most
 */

export type ScoringProfile = 'retail' | 'influencer' | 'whale';

export interface ProfileWeights {
  influence: {
    rve: number;      // real_views_estimate
    re: number;       // reach_efficiency
    eq: number;       // engagement_quality
    authority: number;
    penalty_cap: number;
  };
  x: {
    pc: number;       // posting_consistency
    es: number;       // engagement_stability
    eq: number;       // engagement_quality
    penalty_cap: number;
  };
}

export interface ProfileConfig {
  name: string;
  description: string;
  weights: ProfileWeights;
}

export const ScoringProfiles: Record<ScoringProfile, ProfileConfig> = {
  retail: {
    name: 'Retail',
    description: 'Early-stage accounts, small but potentially high signal',
    weights: {
      influence: {
        rve: 0.25,       // reach less important
        re: 0.30,        // efficiency matters more
        eq: 0.30,        // engagement quality critical
        authority: 0.05,
        penalty_cap: 0.5,
      },
      x: {
        pc: 0.40,        // consistency important for growth
        es: 0.35,
        eq: 0.15,
        penalty_cap: 0.4,
      },
    },
  },

  influencer: {
    name: 'Influencer',
    description: 'Mid-size opinion leaders, balanced metrics',
    weights: {
      influence: {
        rve: 0.35,
        re: 0.20,
        eq: 0.25,
        authority: 0.10,
        penalty_cap: 0.6,
      },
      x: {
        pc: 0.35,
        es: 0.35,
        eq: 0.20,
        penalty_cap: 0.4,
      },
    },
  },

  whale: {
    name: 'Whale',
    description: 'Large accounts, media-scale reach',
    weights: {
      influence: {
        rve: 0.45,       // reach most important
        re: 0.10,        // efficiency secondary
        eq: 0.20,
        authority: 0.15,
        penalty_cap: 0.7,
      },
      x: {
        pc: 0.25,
        es: 0.40,        // stability critical at scale
        eq: 0.25,
        penalty_cap: 0.5,
      },
    },
  },
};

/**
 * Get profile config by type
 */
export function getProfileConfig(profile: ScoringProfile): ProfileConfig {
  return ScoringProfiles[profile];
}

/**
 * Get all profile types
 */
export function getAllProfiles(): ScoringProfile[] {
  return ['retail', 'influencer', 'whale'];
}
