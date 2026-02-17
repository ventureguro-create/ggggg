/**
 * Project Types - E2 Phase
 * 
 * Project = First-class entity in the network graph
 * Shows WHY a project matters through network, capital and influence.
 * 
 * Key principle: Project authority comes from backers + accounts, not marketing.
 */

// ============================================================
// PROJECT ENTITY TYPES
// ============================================================

export type ProjectStage = 'EARLY' | 'GROWTH' | 'MATURE';

export type ProjectCategory =
  | 'DEFI'
  | 'INFRA'
  | 'NFT'
  | 'GAMING'
  | 'L1'
  | 'L2'
  | 'SOCIAL'
  | 'ORACLE'
  | 'BRIDGE'
  | 'EXCHANGE'
  | 'DATA'
  | 'SECURITY';

export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

// ============================================================
// PROJECT ENTITY
// ============================================================

export interface ProjectEntity {
  id: string;
  slug: string;
  name: string;
  description?: string;
  
  categories: ProjectCategory[];
  stage: ProjectStage;
  launchYear?: number;
  status: ProjectStatus;
  
  // Scores (computed)
  authorityScore: number;      // 0-100, computed from backers + accounts
  realityScore: number | null; // 0-1, from Reality Layer
  confidence: number;          // 0-1
  
  // External references
  externalRefs?: {
    website?: string;
    twitter?: string;
    github?: string;
    coingecko?: string;
    defillama?: string;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// PROJECT BACKER (Project ↔ Backer relationship)
// ============================================================

export type InvestmentRound = 'SEED' | 'PRIVATE' | 'SERIES_A' | 'SERIES_B' | 'STRATEGIC' | 'PUBLIC';

export interface ProjectBacker {
  backerId: string;
  backerName: string;
  backerType: string;
  
  seedAuthority: number;
  coinvestWeight: number;
  
  isAnchor: boolean;
  anchorReason?: 'SEED' | 'LEAD' | 'REPEAT' | 'STRATEGIC';
  
  rounds: InvestmentRound[];
}

// ============================================================
// PROJECT ACCOUNT (Project ↔ Account relationship)
// ============================================================

export type AccountRole = 
  | 'FOUNDER'
  | 'DEV'
  | 'CORE'
  | 'ADVOCATE'
  | 'MEDIA'
  | 'INVESTOR'
  | 'OTHER';

export type RealityBadge = 'CONFIRMED' | 'MIXED' | 'RISKY' | 'UNKNOWN';

export interface ProjectAccount {
  actorId: string;
  twitterHandle?: string;
  
  role: AccountRole;
  authority: number;
  trustMultiplier: number;
  realityBadge: RealityBadge;
}

// ============================================================
// PROJECT NETWORK (Local subgraph)
// ============================================================

export type NetworkEdgeType = 'BACKS' | 'CO_INVEST' | 'ADVOCATES' | 'FOLLOWS';

export interface NetworkNode {
  id: string;
  type: 'PROJECT' | 'BACKER' | 'ACCOUNT';
  name: string;
  authority?: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  type: NetworkEdgeType;
  weight: number;
}

export interface ProjectNetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

// ============================================================
// RELATED PROJECTS
// ============================================================

export type RelatedReason = 'SHARED_BACKERS' | 'SHARED_ACCOUNTS' | 'SAME_CATEGORY';

export interface RelatedProject {
  projectId: string;
  projectName: string;
  projectSlug: string;
  
  reasons: RelatedReason[];
  strength: number; // 0-1
  
  // Explain data
  sharedBackers?: string[];
  sharedAccounts?: string[];
}

// ============================================================
// WHY IT MATTERS (Generated)
// ============================================================

export interface WhyItMatters {
  backersSummary: string;      // "Backed by a16z and Paradigm"
  accountsSummary: string;     // "Supported by trusted smart accounts"
  realitySummary: string;      // "Shows consistent on-chain confirmation"
  
  anchorBackers: string[];
  trustedAccounts: string[];
  realitySignal: 'STRONG' | 'MODERATE' | 'WEAK' | 'UNKNOWN';
}

// ============================================================
// INPUT TYPES
// ============================================================

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
  categories: ProjectCategory[];
  stage: ProjectStage;
  launchYear?: number;
  externalRefs?: ProjectEntity['externalRefs'];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  categories?: ProjectCategory[];
  stage?: ProjectStage;
  status?: ProjectStatus;
  externalRefs?: ProjectEntity['externalRefs'];
}

export interface LinkBackerInput {
  projectId: string;
  backerId: string;
  rounds?: InvestmentRound[];
  isAnchor?: boolean;
  anchorReason?: 'SEED' | 'LEAD' | 'REPEAT' | 'STRATEGIC';
}

export interface LinkAccountInput {
  projectId: string;
  actorId: string;
  twitterHandle?: string;
  role: AccountRole;
}

// ============================================================
// FILTERS
// ============================================================

export interface ProjectListFilters {
  categories?: ProjectCategory[];
  stage?: ProjectStage;
  status?: ProjectStatus;
  minAuthority?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// FORMULAS (FREEZE v2)
// ============================================================

/**
 * Project Authority Formula:
 * 
 * project_authority = 
 *   0.45 * seed_authority
 * + 0.35 * network_authority  
 * + 0.20 * reality_score
 * 
 * Where:
 * - seed_authority = max(backer.seedAuthority) * anchor_boost
 * - network_authority = avg(backer.coinvestWeight, account.authority * trustMultiplier)
 * - reality_score = from Reality Layer (CONFIRMS vs CONTRADICTS)
 */

export const PROJECT_AUTHORITY_WEIGHTS = {
  SEED: 0.45,
  NETWORK: 0.35,
  REALITY: 0.20,
};

export const ANCHOR_BOOST = 1.15; // 15% boost for having anchor backer

console.log('[Projects] Types module loaded (E2 Phase)');
