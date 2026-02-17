/**
 * Backer Types - Phase 1
 * 
 * Backers = Real-world entities (funds, projects, DAOs)
 * that provide seed authority independent of Twitter.
 * 
 * Key principle: Twitter NEVER creates authority, only inherits.
 */

// ============================================================
// BACKER ENTITY TYPES
// ============================================================

export type BackerType = 
  | 'FUND'        // VCs, Hedge funds, Corporate venture
  | 'PROJECT'     // Protocols, Infrastructure, L1/L2
  | 'DAO'         // DAO treasuries, Governance
  | 'ECOSYSTEM'   // Exchanges, Infra providers
  | 'COMPANY';    // Traditional companies in crypto

export type BackerCategory =
  | 'DEFI'
  | 'INFRA'
  | 'NFT'
  | 'TRADING'
  | 'GAMING'
  | 'SECURITY'
  | 'LAYER1'
  | 'LAYER2'
  | 'SOCIAL'
  | 'DATA'
  | 'ORACLE';

// ============================================================
// ACCOUNT TAXONOMY (Phase 2)
// ============================================================

/**
 * Account Category - Primary classification
 * Used for filtering and grouping accounts
 */
export type AccountCategory =
  | 'VC_FUND'           // Venture Capital funds (a16z, Paradigm)
  | 'HEDGE_FUND'        // Crypto hedge funds
  | 'PROTOCOL'          // DeFi/Infra protocols
  | 'EXCHANGE'          // CEX/DEX
  | 'INFLUENCER'        // KOLs, thought leaders
  | 'MEDIA'             // News, research, podcasts
  | 'BUILDER'           // Developers, founders
  | 'WHALE'             // Large token holders
  | 'SERVICE'           // B2B services, tools
  | 'DAO'               // DAOs and governance
  | 'FOUNDATION';       // Protocol foundations

/**
 * Account Subtype - Secondary classification
 * More granular typing within categories
 */
export type AccountSubtype =
  // VC subtypes
  | 'TIER1_VC'          // Top-tier VCs (a16z, Paradigm)
  | 'TIER2_VC'          // Mid-tier VCs
  | 'ANGEL'             // Angel investors
  | 'CORPORATE_VC'      // Corporate venture arms
  // Protocol subtypes
  | 'L1_CHAIN'          // Layer 1 blockchains
  | 'L2_CHAIN'          // Layer 2 solutions
  | 'DEFI_BLUE_CHIP'    // Established DeFi (Uniswap, Aave)
  | 'DEFI_EMERGING'     // New DeFi protocols
  | 'NFT_PLATFORM'      // NFT marketplaces
  | 'GAMING_PLATFORM'   // Gaming platforms
  // Influencer subtypes
  | 'CRYPTO_NATIVE'     // Crypto-native KOLs
  | 'TRADFI_CROSSOVER'  // TradFi people in crypto
  | 'TECH_FOUNDER'      // Tech founders exploring crypto
  | 'RESEARCHER'        // Academic/research
  // Exchange subtypes
  | 'CEX_MAJOR'         // Major CEXs (Binance, Coinbase)
  | 'CEX_REGIONAL'      // Regional exchanges
  | 'DEX'               // Decentralized exchanges
  // Other
  | 'AGGREGATOR'        // Data aggregators
  | 'ORACLE'            // Oracle providers
  | 'BRIDGE'            // Cross-chain bridges
  | 'CUSTODIAN'         // Custody services
  | 'UNCLASSIFIED';     // Not yet classified

/**
 * Taxonomy metadata for an account
 */
export interface AccountTaxonomy {
  category?: AccountCategory;
  subtype?: AccountSubtype;
  confidence: number;        // 0-1, how confident we are in classification
  source: 'MANUAL' | 'AI_SUGGESTED' | 'INFERRED';
  suggestedAt?: Date;
  confirmedAt?: Date;
  confirmedBy?: string;
}

export type SeedSource =
  | 'MANUAL'      // Admin-entered
  | 'CURATED'     // From curated lists
  | 'EXTERNAL';   // From external APIs (DefiLlama, etc)

export type BackerStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PENDING'
  | 'ARCHIVED';

// ============================================================
// BACKER ENTITY
// ============================================================

export interface BackerEntity {
  id: string;
  slug: string;           // URL-friendly identifier
  name: string;
  description?: string;
  
  type: BackerType;
  categories: BackerCategory[];
  status: BackerStatus;
  
  // Account Taxonomy (Phase 2)
  taxonomy?: AccountTaxonomy;
  
  // Seed Authority (0-100)
  seedAuthority: number;
  confidence: number;     // 0-1
  source: SeedSource;
  
  // External references
  externalRefs?: {
    website?: string;
    coingecko?: string;
    defillama?: string;
    crunchbase?: string;
    github?: string;
  };
  
  // Freeze state
  frozen: boolean;
  frozenAt?: Date;
  frozenBy?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// ============================================================
// BACKER BINDING (Backer ↔ Twitter/Actor)
// ============================================================

export type BackerBindingType =
  | 'OWNER'       // Main account of backer
  | 'INVESTOR'    // Backer is investor in this entity
  | 'BUILDER'     // Account is builder/team of backer
  | 'AFFILIATED'  // General affiliation
  | 'ECOSYSTEM';  // Part of backer's ecosystem

export type BindingTargetType = 'TWITTER' | 'ACTOR';

export interface BackerBinding {
  id: string;
  backerId: string;
  
  targetType: BindingTargetType;
  targetId: string;         // Twitter ID or Actor ID
  targetHandle?: string;    // For display
  
  relation: BackerBindingType;
  weight: number;           // 0-1, how much authority flows
  
  verified: boolean;
  verifiedAt?: Date;
  
  createdAt: Date;
  createdBy?: string;
}

// ============================================================
// INHERITED AUTHORITY
// ============================================================

export interface InheritedAuthority {
  twitterId: string;
  
  // Computed values
  baseAuthority: number;      // Own authority (if any)
  inheritedAuthority: number; // From backers
  finalAuthority: number;     // Combined
  
  // Sources
  sources: {
    backerId: string;
    backerName: string;
    contribution: number;
    relation: BackerBindingType;
  }[];
  
  // Caps applied
  capApplied: boolean;
  cappedFrom?: number;
}

// ============================================================
// NETWORK ANCHOR (for Network v2)
// ============================================================

export type NetworkAnchorType =
  | 'BACKER'      // From Backer entity
  | 'EXCHANGE'    // Known exchange
  | 'INFRA'       // Infrastructure provider
  | 'CORE_DEV'    // Core developer/team
  | 'FOUNDATION'  // Foundation account
  | 'MANUAL';     // Manual anchor assignment

export interface NetworkAnchor {
  id: string;
  type: NetworkAnchorType;
  name: string;
  
  weight: number;       // 0-1
  confidence: number;   // 0-1
  
  // Reference to source
  sourceType?: 'BACKER' | 'MANUAL';
  sourceId?: string;
}

// ============================================================
// BACKER CREATE/UPDATE DTOs
// ============================================================

export interface CreateBackerInput {
  slug: string;
  name: string;
  description?: string;
  type: BackerType;
  categories: BackerCategory[];
  seedAuthority: number;
  confidence: number;
  source: SeedSource;
  externalRefs?: BackerEntity['externalRefs'];
  // Phase 2: Taxonomy
  taxonomy?: {
    category?: AccountCategory;
    subtype?: AccountSubtype;
  };
}

export interface UpdateBackerInput {
  name?: string;
  description?: string;
  categories?: BackerCategory[];
  seedAuthority?: number;
  confidence?: number;
  status?: BackerStatus;
  externalRefs?: BackerEntity['externalRefs'];
  // Phase 2: Taxonomy
  taxonomy?: {
    category?: AccountCategory;
    subtype?: AccountSubtype;
  };
}

export interface CreateBindingInput {
  backerId: string;
  targetType: BindingTargetType;
  targetId: string;
  targetHandle?: string;
  relation: BackerBindingType;
  weight?: number;
}

// ============================================================
// BACKER LIST FILTERS
// ============================================================

export interface BackerListFilters {
  type?: BackerType;
  categories?: BackerCategory[];
  status?: BackerStatus;
  minAuthority?: number;
  frozen?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  // Phase 2: Taxonomy filters
  accountCategory?: AccountCategory;
  accountSubtype?: AccountSubtype;
}

// ============================================================
// CONSTANTS
// ============================================================

export const AUTHORITY_INHERITANCE_CAP = 0.85; // Max inheritance = 85% of backer
export const MIN_BINDING_WEIGHT = 0.1;
export const MAX_BINDING_WEIGHT = 1.0;

export const BACKER_TYPE_WEIGHTS: Record<BackerType, number> = {
  FUND: 1.0,
  PROJECT: 0.9,
  DAO: 0.85,
  ECOSYSTEM: 0.8,
  COMPANY: 0.75,
};

// Phase 2: Taxonomy constants
export const ACCOUNT_CATEGORIES: AccountCategory[] = [
  'VC_FUND', 'HEDGE_FUND', 'PROTOCOL', 'EXCHANGE', 'INFLUENCER',
  'MEDIA', 'BUILDER', 'WHALE', 'SERVICE', 'DAO', 'FOUNDATION'
];

export const ACCOUNT_SUBTYPES: AccountSubtype[] = [
  'TIER1_VC', 'TIER2_VC', 'ANGEL', 'CORPORATE_VC',
  'L1_CHAIN', 'L2_CHAIN', 'DEFI_BLUE_CHIP', 'DEFI_EMERGING',
  'NFT_PLATFORM', 'GAMING_PLATFORM',
  'CRYPTO_NATIVE', 'TRADFI_CROSSOVER', 'TECH_FOUNDER', 'RESEARCHER',
  'CEX_MAJOR', 'CEX_REGIONAL', 'DEX',
  'AGGREGATOR', 'ORACLE', 'BRIDGE', 'CUSTODIAN', 'UNCLASSIFIED'
];

// Category to subtypes mapping for UI
export const CATEGORY_SUBTYPES: Record<AccountCategory, AccountSubtype[]> = {
  VC_FUND: ['TIER1_VC', 'TIER2_VC', 'ANGEL', 'CORPORATE_VC'],
  HEDGE_FUND: ['TIER1_VC', 'TIER2_VC'],
  PROTOCOL: ['L1_CHAIN', 'L2_CHAIN', 'DEFI_BLUE_CHIP', 'DEFI_EMERGING', 'NFT_PLATFORM', 'GAMING_PLATFORM'],
  EXCHANGE: ['CEX_MAJOR', 'CEX_REGIONAL', 'DEX'],
  INFLUENCER: ['CRYPTO_NATIVE', 'TRADFI_CROSSOVER', 'TECH_FOUNDER', 'RESEARCHER'],
  MEDIA: ['AGGREGATOR', 'RESEARCHER'],
  BUILDER: ['TECH_FOUNDER', 'CRYPTO_NATIVE'],
  WHALE: ['CRYPTO_NATIVE'],
  SERVICE: ['CUSTODIAN', 'AGGREGATOR', 'ORACLE', 'BRIDGE'],
  DAO: ['DEFI_BLUE_CHIP', 'DEFI_EMERGING'],
  FOUNDATION: ['L1_CHAIN', 'L2_CHAIN'],
};

console.log('[Backers] Types module loaded');
