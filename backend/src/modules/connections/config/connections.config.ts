/**
 * Connections Module - Configuration
 * 
 * Self-contained configuration for the connections module.
 * No dependencies on host configuration.
 */

export interface ConnectionsModuleConfig {
  // Module toggle
  enabled: boolean;
  
  // Database
  database: {
    collectionPrefix: string; // 'connections_' by default
    uri?: string; // Optional override, uses host DB if not set
  };
  
  // Twitter
  twitter: {
    parserUrl: string;
    parserEnabled: boolean;
    maxRequestsPerMinute: number;
  };
  
  // Jobs
  jobs: {
    followGraphIntervalMinutes: number;
    clusterDetectionIntervalMinutes: number;
    narrativeEngineIntervalMinutes: number;
    audienceQualityIntervalMinutes: number;
  };
  
  // Scoring
  scoring: {
    influenceWeights: {
      followers: number;
      engagement: number;
      authority: number;
      early: number;
      smart: number;
    };
    trustDecayDays: number;
    minCredibilityThreshold: number;
  };
  
  // IPS (Influencer Prediction System)
  ips: {
    eventWindowMinutes: number;
    outcomeWindowHours: number;
    minConfidenceThreshold: number;
  };
  
  // Reality Layer
  reality: {
    verdictCacheMinutes: number;
    credibilityUpdateHours: number;
  };
  
  // Feature Flags
  features: {
    clusterAttention: boolean;
    farmDetection: boolean;
    narrativeEngine: boolean;
    walletAttribution: boolean;
    altPatterns: boolean;
  };
}

// Default configuration
export const defaultConnectionsConfig: ConnectionsModuleConfig = {
  enabled: true,
  
  database: {
    collectionPrefix: 'connections_',
  },
  
  twitter: {
    parserUrl: process.env.PARSER_URL || 'http://localhost:5001',
    parserEnabled: true,
    maxRequestsPerMinute: 30,
  },
  
  jobs: {
    followGraphIntervalMinutes: 30,
    clusterDetectionIntervalMinutes: 60,
    narrativeEngineIntervalMinutes: 15,
    audienceQualityIntervalMinutes: 120,
  },
  
  scoring: {
    influenceWeights: {
      followers: 0.15,
      engagement: 0.20,
      authority: 0.25,
      early: 0.20,
      smart: 0.20,
    },
    trustDecayDays: 30,
    minCredibilityThreshold: 0.3,
  },
  
  ips: {
    eventWindowMinutes: 60,
    outcomeWindowHours: 24,
    minConfidenceThreshold: 0.6,
  },
  
  reality: {
    verdictCacheMinutes: 30,
    credibilityUpdateHours: 24,
  },
  
  features: {
    clusterAttention: true,
    farmDetection: true,
    narrativeEngine: true,
    walletAttribution: true,
    altPatterns: true,
  },
};

// Runtime config instance
let currentConfig: ConnectionsModuleConfig = { ...defaultConnectionsConfig };

/**
 * Get current configuration
 */
export function getConnectionsConfig(): ConnectionsModuleConfig {
  return currentConfig;
}

/**
 * Update configuration (partial)
 */
export function updateConnectionsConfig(updates: Partial<ConnectionsModuleConfig>): void {
  currentConfig = { ...currentConfig, ...updates };
}

/**
 * Reset to defaults
 */
export function resetConnectionsConfig(): void {
  currentConfig = { ...defaultConnectionsConfig };
}

/**
 * Collection names with prefix
 */
export function getCollectionName(name: string): string {
  return `${currentConfig.database.collectionPrefix}${name}`;
}

// Namespaced collection names
export const COLLECTIONS = {
  // Actors
  ACTORS: 'connections_actors',
  UNIFIED_ACCOUNTS: 'connections_unified_accounts',
  FOLLOW_GRAPH: 'connections_follow_graph',
  
  // Events & IPS
  EVENTS: 'connections_events',
  IPS_PREDICTIONS: 'connections_ips_predictions',
  IPS_OUTCOMES: 'connections_ips_outcomes',
  
  // Clusters
  CLUSTERS: 'connections_clusters',
  CLUSTER_MEMBERS: 'connections_cluster_members',
  CLUSTER_MOMENTUM: 'connections_cluster_momentum',
  CLUSTER_CREDIBILITY: 'connections_cluster_credibility',
  CLUSTER_ALIGNMENTS: 'connections_cluster_alignments',
  CLUSTER_TOKEN_ATTENTION: 'connections_cluster_token_attention',
  INFLUENCER_CLUSTERS: 'connections_influencer_clusters',
  
  // Audience Quality
  AUDIENCE_QUALITY: 'connections_audience_quality',
  AUDIENCE_REPORTS: 'connections_audience_reports',
  FARM_OVERLAP_EDGES: 'connections_farm_overlap_edges',
  BOT_FARMS: 'connections_bot_farms',
  
  // Taxonomy
  TAXONOMY_GROUPS: 'connections_taxonomy_groups',
  TAXONOMY_PRESETS: 'connections_taxonomy_presets',
  TAXONOMY_MEMBERSHIPS: 'connections_taxonomy_memberships',
  
  // Reality Layer
  VERDICTS: 'connections_verdicts',
  CREDIBILITY_SCORES: 'connections_credibility_scores',
  TRUST_MULTIPLIERS: 'connections_trust_multipliers',
  
  // Alt Patterns
  ALT_PATTERNS: 'connections_alt_patterns',
  ALT_SCORES: 'connections_alt_scores',
  PATTERN_MATCHES: 'connections_pattern_matches',
  ALT_SEASON_STATE: 'connections_alt_season_state',
  
  // Watchlists
  WATCHLISTS: 'connections_watchlists',
  WATCHLIST_ITEMS: 'connections_watchlist_items',
  
  // Notifications
  NOTIFICATION_SETTINGS: 'connections_notification_settings',
  NOTIFICATION_DELIVERIES: 'connections_notification_deliveries',
  
  // Projects
  PROJECTS: 'connections_projects',
  PROJECT_BACKERS: 'connections_project_backers',
  PROJECT_ACCOUNTS: 'connections_project_accounts',
  
  // Token & Market
  TOKEN_MOMENTUM: 'connections_token_momentum',
  TOKEN_OPPORTUNITIES: 'connections_token_opportunities',
  OPPORTUNITY_OUTCOMES: 'connections_opportunity_outcomes',
  MARKET_STATE_ATTRIBUTION: 'connections_market_state_attribution',
  TOKEN_PRICES: 'connections_token_prices',
  
  // Graph
  BACKER_COINVEST_EDGES: 'connections_backer_coinvest_edges',
  TWITTER_FOLLOWS: 'connections_twitter_follows',
  PARSER_FOLLOW_EDGES: 'connections_parser_follow_edges',
  PARSER_FOLLOWER_EDGES: 'connections_parser_follower_edges',
  
  // Asset Lifecycle
  ASSET_LIFECYCLE: 'connections_asset_lifecycle',
  
  // Config
  MODULE_CONFIG: 'connections_module_config',
} as const;

// Legacy collection mapping (for migration)
export const LEGACY_TO_NEW_COLLECTIONS: Record<string, string> = {
  'influencer_clusters': COLLECTIONS.INFLUENCER_CLUSTERS,
  'cluster_token_momentum': COLLECTIONS.CLUSTER_MOMENTUM,
  'cluster_token_attention': COLLECTIONS.CLUSTER_TOKEN_ATTENTION,
  'cluster_credibility': COLLECTIONS.CLUSTER_CREDIBILITY,
  'cluster_price_alignment': COLLECTIONS.CLUSTER_ALIGNMENTS,
  'token_momentum': COLLECTIONS.TOKEN_MOMENTUM,
  'token_opportunities': COLLECTIONS.TOKEN_OPPORTUNITIES,
  'opportunity_outcomes': COLLECTIONS.OPPORTUNITY_OUTCOMES,
  'market_state_attribution': COLLECTIONS.MARKET_STATE_ATTRIBUTION,
  'alt_season_state': COLLECTIONS.ALT_SEASON_STATE,
  'projects': COLLECTIONS.PROJECTS,
  'project_backers': COLLECTIONS.PROJECT_BACKERS,
  'project_accounts': COLLECTIONS.PROJECT_ACCOUNTS,
  'backer_coinvest_edges': COLLECTIONS.BACKER_COINVEST_EDGES,
  'twitter_follows': COLLECTIONS.TWITTER_FOLLOWS,
  'parser_follow_edges': COLLECTIONS.PARSER_FOLLOW_EDGES,
  'parser_follower_edges': COLLECTIONS.PARSER_FOLLOWER_EDGES,
};
