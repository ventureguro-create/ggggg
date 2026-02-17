/**
 * Connections Admin Configuration
 * 
 * All feature flags and thresholds for the Connections module.
 * Controlled via env vars or admin API.
 */

export interface ConnectionsAdminConfig {
  // Master switch
  enabled: boolean;
  
  // Feature flags
  influence_score_enabled: boolean;
  risk_detection_enabled: boolean;
  
  // P2.2: Graph Share
  graph_share_enabled: boolean;
  graph_share_version: string;
  
  // Thresholds
  thresholds: {
    high_risk_score: number;      // Below this = high risk
    medium_risk_score: number;    // Below this = medium risk
    min_engagement_quality: number; // Below this = red flag
  };
  
  // API settings
  api_enabled: boolean;
  max_results_per_page: number;
}

// Default config (can be overridden by env)
export const connectionsAdminConfig: ConnectionsAdminConfig = {
  enabled: process.env.CONNECTIONS_MODULE_ENABLED !== 'false',
  
  influence_score_enabled: true,
  risk_detection_enabled: true,
  
  // P2.2: Graph Share
  graph_share_enabled: true,
  graph_share_version: '1.0',
  
  thresholds: {
    high_risk_score: 200,
    medium_risk_score: 500,
    min_engagement_quality: 0.001,
  },
  
  api_enabled: true,
  max_results_per_page: 100,
};

// Runtime config update (for admin API)
export function updateConnectionsConfig(updates: Partial<ConnectionsAdminConfig>): void {
  Object.assign(connectionsAdminConfig, updates);
  console.log('[ConnectionsAdmin] Config updated:', connectionsAdminConfig);
}
