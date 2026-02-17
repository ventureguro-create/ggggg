/**
 * Follow Graph v2 - Type Definitions
 * 
 * PHASE A1: Directed follow-edges for hierarchy understanding
 * 
 * FORMULA:
 * follow_weight = authority(follower) × recency_decay × activity_factor × credibility_factor
 */

export interface TwitterFollowEdge {
  fromAuthorId: string;     // follower
  toAuthorId: string;       // followed
  followedAt: Date;
  parsedAt: Date;
  source: 'twitter' | 'mock';
}

export interface FollowWeight {
  authorityBoost: number;   // 0.3 - 1.5 (authority of follower)
  recencyDecay: number;     // 0 - 1 (e^(-days/180))
  activityFactor: number;   // 0.2 - 1.0 (min(1, tweets_30d / 10))
  credibilityFactor: number; // 0.3 - 1.3 (trust multiplier from Reality)
  finalWeight: number;      // combined weight
}

export interface FollowEdgeWithWeight extends TwitterFollowEdge {
  weight: FollowWeight;
  followerAuthority: number;
}

// Graph edge representation
export interface FollowGraphEdge {
  source: string;
  target: string;
  type: 'FOLLOW';
  direction: 'IN';          // follower → followed
  weight: number;
  confidence: number;
  authorityBoost: number;
  recencyDecay: number;
  followedAt: Date;
}

// Config for follow weight calculation
export interface FollowWeightConfig {
  baseWeight: number;           // 0.1
  authorityMultiplierMin: number;  // 0.3
  authorityMultiplierMax: number;  // 1.5
  recencyHalfLifeDays: number;     // 180 days
  minRecencyWeight: number;        // 0.1
  activityMinWeight: number;       // 0.2 (silent accounts still count)
  activityTweetsThreshold: number; // 10 tweets in 30d for full weight
  credibilityMin: number;          // 0.3 (talking books penalty)
  credibilityMax: number;          // 1.3 (reality-confirmed boost)
  layerWeightCap: number;          // 0.25
}

export const DEFAULT_FOLLOW_CONFIG: FollowWeightConfig = {
  baseWeight: 0.1,
  authorityMultiplierMin: 0.3,
  authorityMultiplierMax: 1.5,
  recencyHalfLifeDays: 180,
  minRecencyWeight: 0.1,
  activityMinWeight: 0.2,
  activityTweetsThreshold: 10,
  credibilityMin: 0.3,
  credibilityMax: 1.3,
  layerWeightCap: 0.25,
};
