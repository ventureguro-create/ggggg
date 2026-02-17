/**
 * BLOCKS 15-28 Type Definitions
 * 
 * Complete type system for:
 * - Block 15: Shared Bot Farms
 * - Block 16: Audience Quality Index (AQI)
 * - Block 17: Fake Growth Detector
 * - Block 18: Follower Identity Clustering
 * - Block 19: Cross-Influencer Farm Graph
 * - Block 20: Real Top Followers
 * - Block 21: Influencer Authenticity Score
 * - Block 22: Authority Adjustment
 * - Block 23: Bot Market Signals
 * - Block 24: Alert Gate
 * - Block 25: Wallet-Bot Correlation
 * - Block 26: Wallet Attribution Expansion
 * - Block 27: Actor Behavior Profiles
 * - Block 28: Strategy Simulation
 */

// ============================================
// BLOCK 15 - Shared Bot Farms
// ============================================
export interface BotFarm {
  farmId: string;
  actorIds: string[];
  sharedFollowers: number;
  botRatio: number;         // 0..1
  suspiciousRatio: number;  // 0..1
  confidence: number;       // итоговый вес
  createdAt: Date;
}

// ============================================
// BLOCK 16 - Audience Quality Index (AQI)
// ============================================
export type FollowerLabel = 'HUMAN' | 'SUSPICIOUS' | 'BOT';
export type ActivityBucket = 'ACTIVE' | 'DORMANT' | 'DEAD';
export type AQILevel = 'ELITE' | 'GOOD' | 'MIXED' | 'RISKY';

export interface FollowerVector {
  followerId: string;
  actorId: string;
  followersCount?: number;
  followingCount?: number;
  tweetsCount?: number;
  verified?: boolean;
  createdAt?: string;
  lastActiveAt?: string;
  label: FollowerLabel;
  activity: ActivityBucket;
  scoreHuman: number;
  scoreSuspicious: number;
  scoreBot: number;
}

export interface AudienceQualityReport {
  actorId: string;
  windowDays: number;
  totalFollowers: number;
  sampledFollowers: number;
  pctHuman: number;
  pctSuspicious: number;
  pctBot: number;
  pctActive: number;
  pctDormant: number;
  pctDead: number;
  aqi: number;
  level: AQILevel;
  reasons: string[];
  updatedAt: string;
}

// ============================================
// BLOCK 17 - Fake Growth Detector
// ============================================
export type GrowthLabel = 'CLEAN' | 'SUSPICIOUS' | 'MANIPULATED';

export interface GrowthSnapshot {
  actorId: string;
  ts: string;
  followers: number;
  following: number;
  deltaFollowers: number;
  deltaFollowing: number;
  likes: number;
  replies: number;
  retweets: number;
}

export interface FakeGrowthReport {
  actorId: string;
  windowDays: number;
  avgDailyGrowth: number;
  maxSpike: number;
  churnRate: number;
  deadGrowthRate: number;
  followRingScore: number;
  growthScore: number;
  label: GrowthLabel;
  reasons: string[];
  updatedAt: string;
}

// ============================================
// BLOCK 18 - Follower Identity Clustering
// ============================================
export type FarmLevel = 'FARM' | 'PARTIAL_FARM' | 'CLEAN';

export interface FollowerIdentity {
  followerId: string;
  accountAgeDays: number;
  followers: number;
  following: number;
  tweetsTotal: number;
  tweetsLast30d: number;
  avgLikes: number;
  avgReplies: number;
  bioLength: number;
  hasAvatar: boolean;
  followTs: string;
}

export interface ClusterStats {
  hash: string;
  size: number;
  avgAccountAge: number;
  avgTweets: number;
  followTimeSpreadHours: number;
}

export interface FollowerClusterReport {
  actorId: string;
  totalFollowers: number;
  clusters: number;
  farmClusters: number;
  farmScore: number;
  reuseScore: number;
  label: FarmLevel;
  updatedAt: string;
}

// ============================================
// BLOCK 19 - Cross-Influencer Farm Graph
// ============================================
export interface FarmOverlapEdge {
  a: string;
  b: string;
  sharedSuspects: number;
  sharedTotal: number;
  jaccard: number;
  overlapScore: number;
  topClusters: Array<{ hash: string; cnt: number }>;
  updatedAt: Date;
}

export interface FarmGraphData {
  nodes: Array<{ id: string; type: string }>;
  edges: FarmOverlapEdge[];
}

// ============================================
// BLOCK 20 - Real Top Followers
// ============================================
export interface FollowerFeatures {
  followers: number;
  following: number;
  accountAgeDays: number;
  tweets30d: number;
  likes30d: number;
  retweets30d: number;
  followsPerDay: number;
  isVerified: boolean;
}

export interface RealTopFollower {
  followerId: string;
  handle?: string;
  avatar?: string;
  followers: number;
  qualityScore: number;
  farmLevel: FarmLevel;
  realScore: number;
}

// ============================================
// BLOCK 21 - Influencer Authenticity Score (IAS)
// ============================================
export type AuthenticityLabel = 'ORGANIC' | 'MOSTLY_REAL' | 'MIXED' | 'FARMED' | 'HIGHLY_FARMED';

export interface InfluencerAuthenticityReport {
  actorId: string;
  score: number;
  label: AuthenticityLabel;
  breakdown: {
    realFollowerRatio: number;
    audienceQuality: number;
    networkIntegrity: number;
  };
  updatedAt: string;
}

// ============================================
// BLOCK 22 - Authority Adjustment
// ============================================
export interface AuthorityAdjustment {
  actorId: string;
  baseAuthority: number;
  authenticityScore: number;
  authenticityMultiplier: number;
  finalAuthority: number;
  label: AuthenticityLabel;
  updatedAt: string;
}

// ============================================
// BLOCK 23 - Bot Market Signals (BMS)
// ============================================
export type BMSLabel = 'CLEAN' | 'WATCH' | 'MANIPULATED' | 'STRONGLY_MANIPULATED' | 'ARTIFICIAL';

export interface BotMarketSignal {
  actorId: string;
  window: string;
  botInflowRate: number;
  overlapScore: number;
  burstScore: number;
  bms: number;
  label: BMSLabel;
  timestamp: string;
}

// ============================================
// BLOCK 24 - Alert Gate
// ============================================
export interface AlertGateDecision {
  alertId: string;
  authenticity: number;
  bms: number;
  decision: 'SEND' | 'SEND_LOW_PRIORITY' | 'BLOCKED';
  flags: string[];
  confidenceAfter: number;
  reason?: string;
}

// ============================================
// BLOCK 25 - Wallet-Bot Correlation
// ============================================
export type CorrelationLabel = 'CAPITAL_BACKED' | 'POSSIBLE' | 'SOCIAL_NOISE';

export interface ManipulationCorrelation {
  asset: string;
  bms: number;
  onchainFlow: number;
  correlation: number;
  label: CorrelationLabel;
  window: string;
  timestamp: string;
}

// ============================================
// BLOCK 26 - Wallet Attribution Expansion
// ============================================
export interface WalletCluster {
  clusterId: string;
  members: string[];
  confidence: number;
  assets: string[];
  behavior: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  updatedAt: string;
}

export interface WalletSimilarity {
  temporalOverlap: number;
  assetOverlap: number;
  directionMatch: number;
  amountSimilarity: number;
  total: number;
}

// ============================================
// BLOCK 27 - Actor Behavior Profiles
// ============================================
export type ActorProfileType = 
  | 'LONG_TERM_ACCUMULATOR'
  | 'PUMP_AND_EXIT'
  | 'EARLY_CONVICTION'
  | 'LIQUIDITY_PROVIDER'
  | 'NOISE_ACTOR';

export interface ActorBehaviorProfile {
  actorId: string;
  profile: ActorProfileType;
  confidence: number;
  since: string;
  metrics: {
    accumulationBias: number;
    tweetLeadLag: number;
    distributionAfterMentions: number;
    holdingDuration: number;
    confirmationRatio: number;
  };
  updatedAt: string;
}

// ============================================
// BLOCK 28 - Strategy Simulation
// ============================================
export interface StrategyConfig {
  strategy: string;
  filters: Record<string, string>;
}

export interface StrategyMetrics {
  hitRate: number;
  avgFollowThrough: number;
  noiseRatio: number;
  confirmationLag: number;
}

export interface StrategySimulationResult {
  strategy: string;
  window: string;
  metrics: StrategyMetrics;
  sample: number;
  events: Array<{
    eventId: string;
    actorId: string;
    asset: string;
    timestamp: string;
    outcome: 'HIT' | 'MISS' | 'NEUTRAL';
    movePercent: number;
  }>;
  updatedAt: string;
}
