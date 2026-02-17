/**
 * Twitter Live Config (Phase 4.2)
 * Read-only Twitter ingestion configuration
 */

export interface TwitterLiveConfig {
  // Mode
  enabled: boolean;
  mode: 'off' | 'read_only' | 'preview';  // No 'live' write mode here
  
  // Data sources (collections in twitter_results db)
  collections: {
    authors: string;
    engagements: string;
    follow_edges: string;
  };
  
  // Freshness window
  max_age_hours: number;
  
  // Safety
  alerts_disabled: boolean;  // Always true in Phase 4.2
  writes_disabled: boolean;  // Always true in Phase 4.2
  
  // Limits
  max_accounts_per_batch: number;
  max_edges_per_account: number;
}

// Default config - SAFE by design
let config: TwitterLiveConfig = {
  enabled: true,
  mode: 'read_only',
  collections: {
    authors: 'twitter_authors',
    engagements: 'twitter_engagements',
    follow_edges: 'twitter_follows',
  },
  max_age_hours: 336, // 14 days
  alerts_disabled: true,  // ALWAYS
  writes_disabled: true,  // ALWAYS
  max_accounts_per_batch: 100,
  max_edges_per_account: 1000,
};

export function getTwitterLiveConfig(): TwitterLiveConfig {
  return { ...config };
}

export function updateTwitterLiveConfig(updates: Partial<TwitterLiveConfig>): TwitterLiveConfig {
  // Safety: Never allow writes or alerts in Phase 4.2
  config = {
    ...config,
    ...updates,
    alerts_disabled: true,  // Force safe
    writes_disabled: true,  // Force safe
  };
  return config;
}

export function setTwitterLiveMode(mode: 'off' | 'read_only' | 'preview'): void {
  config.mode = mode;
  config.enabled = mode !== 'off';
}
