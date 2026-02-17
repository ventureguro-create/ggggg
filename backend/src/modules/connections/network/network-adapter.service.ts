/**
 * Network Adapter Service
 * 
 * Integrates co-engagement edges with connections scoring.
 * Merges with mock graph, applies overlay.
 */

import { Db } from 'mongodb';
import { buildCoEngagementGraphV2, getCoEngagementConfig, type CoEngagementEdge } from './coengagement/coengagement-graph.builder.js';

export type NetworkMode = 'OFF' | 'CO_ONLY' | 'BLENDED';
export type NetworkSource = 'MOCK' | 'CO_ENGAGEMENT' | 'FOLLOW' | 'BLENDED';

export interface NetworkConfig {
  mode: NetworkMode;
  source: NetworkSource;
  weight_cap: number;         // Max network weight (0.15 = 15%)
  confidence_required: number;
  drift_auto_off: boolean;
}

export interface NetworkEdge {
  from_id: string;
  to_id: string;
  weight: number;
  confidence: number;
  source: NetworkSource;
  is_overlay: boolean;
}

export interface NetworkGraphResult {
  success: boolean;
  mode: NetworkMode;
  source: NetworkSource;
  edges: NetworkEdge[];
  stats: {
    mock_edges: number;
    co_engagement_edges: number;
    total_edges: number;
    avg_weight: number;
    avg_confidence: number;
  };
  warnings: string[];
}

const DEFAULT_CONFIG: NetworkConfig = {
  mode: 'OFF',
  source: 'MOCK',
  weight_cap: 0.15,
  confidence_required: 0.5,
  drift_auto_off: true,
};

let networkConfig: NetworkConfig = { ...DEFAULT_CONFIG };

export function getNetworkConfig(): NetworkConfig {
  return { ...networkConfig };
}

export function updateNetworkConfig(updates: Partial<NetworkConfig>): NetworkConfig {
  networkConfig = {
    ...networkConfig,
    ...updates,
    weight_cap: Math.min(0.15, Math.max(0, updates.weight_cap || networkConfig.weight_cap)),
  };
  console.log('[NetworkAdapter] Config updated:', networkConfig);
  return { ...networkConfig };
}

/**
 * Generate mock edges (placeholder)
 */
function generateMockEdges(): NetworkEdge[] {
  const mockPairs = [
    ['ng_001', 'ng_002'], ['ng_002', 'ng_003'], ['ng_001', 'ng_003'],
    ['br_001', 'br_002'], ['sn_001', 'sn_002'], ['sn_002', 'sn_003'],
  ];

  return mockPairs.map(([from, to]) => ({
    from_id: from,
    to_id: to,
    weight: 0.5 + Math.random() * 0.3,
    confidence: 0.8,
    source: 'MOCK' as NetworkSource,
    is_overlay: false,
  }));
}

/**
 * Build network graph
 */
export async function buildNetworkGraph(db: Db): Promise<NetworkGraphResult> {
  const config = getNetworkConfig();
  
  const result: NetworkGraphResult = {
    success: false,
    mode: config.mode,
    source: config.source,
    edges: [],
    stats: { mock_edges: 0, co_engagement_edges: 0, total_edges: 0, avg_weight: 0, avg_confidence: 0 },
    warnings: [],
  };

  if (config.mode === 'OFF') {
    result.warnings.push('Network adapter disabled');
    result.success = true;
    return result;
  }

  try {
    // Add mock edges if blended
    if (config.mode === 'BLENDED') {
      const mockEdges = generateMockEdges();
      result.edges.push(...mockEdges);
      result.stats.mock_edges = mockEdges.length;
    }

    // Add co-engagement edges
    if (config.mode === 'CO_ONLY' || config.mode === 'BLENDED') {
      const coResult = await buildCoEngagementGraphV2(db);
      
      if (coResult.success) {
        const coEdges: NetworkEdge[] = coResult.edges.map(e => ({
          from_id: e.from_id,
          to_id: e.to_id,
          weight: e.weight,
          confidence: e.confidence,
          source: 'CO_ENGAGEMENT' as NetworkSource,
          is_overlay: config.mode === 'BLENDED',
        }));
        
        result.edges.push(...coEdges);
        result.stats.co_engagement_edges = coEdges.length;
      }
      
      result.warnings.push(...coResult.warnings);
    }

    // Calculate stats
    result.stats.total_edges = result.edges.length;
    result.stats.avg_weight = result.edges.length > 0
      ? result.edges.reduce((s, e) => s + e.weight, 0) / result.edges.length
      : 0;
    result.stats.avg_confidence = result.edges.length > 0
      ? result.edges.reduce((s, e) => s + e.confidence, 0) / result.edges.length
      : 0;

    result.success = true;
    console.log(`[NetworkAdapter] Built ${result.stats.total_edges} edges (mock: ${result.stats.mock_edges}, co: ${result.stats.co_engagement_edges})`);
  } catch (err: any) {
    result.warnings.push(`Build failed: ${err.message}`);
    console.error('[NetworkAdapter] Error:', err.message);
  }

  return result;
}

/**
 * Get network status summary
 */
export async function getNetworkStatus(db: Db): Promise<{
  mode: NetworkMode;
  source: NetworkSource;
  enabled: boolean;
  weight_cap: number;
  edges_available: boolean;
}> {
  const config = getNetworkConfig();
  const graph = config.mode !== 'OFF' ? await buildNetworkGraph(db) : null;
  
  return {
    mode: config.mode,
    source: config.source,
    enabled: config.mode !== 'OFF',
    weight_cap: config.weight_cap,
    edges_available: (graph?.stats.total_edges || 0) > 0,
  };
}
