/**
 * Network v2+ Types
 * 
 * Multi-graph architecture:
 * - Twitter Follow
 * - Co-Engagement
 * - Co-Investment
 * - Onchain (future)
 * - Media Mention (future)
 */

// ============================================================
// NODE TYPES
// ============================================================

export type NetworkNodeType =
  | 'TWITTER'
  | 'BACKER'
  | 'PROJECT'
  | 'MEDIA';

export interface NetworkNode {
  id: string;
  type: NetworkNodeType;
  authority: number;      // 0-1
  categories: string[];
  tags: string[];
  
  // Computed metrics
  metrics?: {
    influence?: number;
    smart?: number;
    network?: number;
    early?: number;
    activity?: number;
    twitterScore?: number;
  };
}

// ============================================================
// EDGE TYPES
// ============================================================

export type NetworkEdgeType =
  | 'FOLLOW'
  | 'CO_ENGAGEMENT'
  | 'CO_INVESTMENT'
  | 'INVESTED_IN'
  | 'ONCHAIN'
  | 'MEDIA_MENTION'
  | 'ANCHOR_LINK';

export type EdgeSource = 'twitter' | 'backers' | 'onchain' | 'media' | 'manual';

export interface NetworkEdge {
  from: string;
  to: string;
  type: NetworkEdgeType;
  weight: number;        // 0-1
  confidence: number;    // 0-1
  source: EdgeSource;
  
  // Optional metadata
  meta?: {
    sharedCount?: number;
    sharedProjects?: string[];
    jaccard?: number;
    round?: string;
    announcedAt?: Date;
  };
}

// ============================================================
// GRAPH SNAPSHOT
// ============================================================

export interface NetworkSnapshot {
  id: string;
  type: 'FULL' | 'CO_INVESTMENT' | 'FOLLOW' | 'CO_ENGAGEMENT';
  createdAt: Date;
  edgesCount: number;
  nodesCount: number;
  params: Record<string, any>;
}

// ============================================================
// AUTHORITY v3
// ============================================================

export interface AuthorityV3 {
  // Components (0-1)
  seedAuthority: number;      // 45%
  onchainAuthority: number;   // 35%
  mediaAuthority: number;     // 20%
  
  // Final score (0-1)
  authority: number;
  
  // Sub-components
  details?: {
    baseTier: number;
    trustFactor: number;
    capitalWeight: number;
    networkPosition: number;
    activityQuality: number;
    reach: number;
    resonance: number;
    credibility: number;
  };
}

// ============================================================
// TWITTER SCORE v2
// ============================================================

export interface TwitterScoreV2 {
  // Components (0-1)
  influence: number;    // 22%
  smart: number;        // 23%
  network: number;      // 25%
  early: number;        // 15%
  activity: number;     // 15%
  
  // Final score (0-1000)
  score: number;
  
  // Sub-components
  details?: {
    followers: number;
    engagementRate: number;
    credibility: number;
    readerWeightSum: number;
    seedAuthority: number;
    inheritedAuthority: number;
    graphCentrality: number;
    earlySignalAvg: number;
    frequency: number;
    consistency: number;
  };
}

// ============================================================
// HANDSHAKE (Social Distance)
// ============================================================

export interface HandshakeScore {
  twitterId: string;
  
  // Main score (0-1)
  score: number;
  
  // Best anchor connection
  bestAnchor?: {
    anchorId: string;
    anchorName: string;
    hops: number;
    pathStrength: number;
    routeType: 'FOLLOW_ROUTE' | 'COINVEST_ROUTE' | 'ENGAGE_ROUTE' | 'MIXED';
  };
  
  // Elite exposure (0-1)
  eliteExposure: number;
  
  // Anchor proximities
  proximities: {
    anchorId: string;
    anchorName: string;
    hops: number;
    proximity: number;
  }[];
}

// ============================================================
// GROUPS (for UI classification)
// ============================================================

export type AccountGroup =
  | 'VC'              // SeedAuthority > 0.7
  | 'EARLY_PROJECTS'  // Early > 0.65
  | 'TRENDING'        // Activity + Influence high
  | 'SMART'           // Smart > 0.7
  | 'NFT'             // NFT cluster
  | 'MEDIA'           // High reach, low inheritance
  | 'POPULAR_PROJECT' // High engagement + network
  | 'MOST_SEARCHED';  // Search + mentions

export interface AccountGroupMembership {
  accountId: string;
  groups: AccountGroup[];
  primaryGroup: AccountGroup;
  scores: Record<AccountGroup, number>;
}

// ============================================================
// BUILD PARAMS
// ============================================================

export interface BuildCoInvestParams {
  fromDate?: Date;
  toDate?: Date;
  minConfidence?: number;
  minSharedProjects?: number;
  topK?: number;
  computeJaccard?: boolean;
}

export interface BuildResult {
  snapshotId: string;
  edgesBuilt: number;
  nodesProcessed: number;
  durationMs: number;
  warnings: string[];
}

// ============================================================
// CONSTANTS
// ============================================================

// Twitter Score v2 weights
export const TWITTER_SCORE_WEIGHTS = {
  influence: 0.22,
  smart: 0.23,
  network: 0.25,
  early: 0.15,
  activity: 0.15,
};

// Authority v3 weights
export const AUTHORITY_WEIGHTS = {
  seed: 0.45,
  onchain: 0.35,
  media: 0.20,
};

// Network component weights
export const NETWORK_WEIGHTS = {
  seedAuthority: 0.40,
  inheritedAuthority: 0.35,
  graphCentrality: 0.25,
};

// Hop weights for handshake
export const HOP_WEIGHTS = {
  1: 1.00,
  2: 0.55,
  3: 0.30,
};

// Edge type multipliers
export const EDGE_TYPE_MULTIPLIERS = {
  FOLLOW: 1.00,
  CO_INVESTMENT: 1.00,
  INVESTED_IN: 0.90,
  CO_ENGAGEMENT: 0.55,
  ANCHOR_LINK: 0.85,
  ONCHAIN: 0.80,
  MEDIA_MENTION: 0.40,
};

// Reader weights for Smart score
export const READER_WEIGHTS = {
  VC_BACKER: 1.0,
  SMART_TRADER: 0.8,
  EARLY_PROJECT: 0.6,
  MEDIA: 0.4,
  RETAIL: 0.2,
};

// Seed Authority tiers
export const SEED_TIERS = {
  TIER_0: 1.00,  // Anchor VC / L1 / CEX
  TIER_1: 0.85,  // Top Crypto Fund / Project
  TIER_2: 0.65,  // Mid VC / Infra / DAO
  TIER_3: 0.45,  // Small fund / startup
  UNKNOWN: 0.00,
};

console.log('[NetworkV2+] Types loaded');
