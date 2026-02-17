/**
 * Graph Overlay Builder
 * 
 * Combines multiple graph sources into unified overlay:
 * - Mock edges (gray)
 * - Live co-engagement edges (blue)
 * - Live follow edges (green) - DISABLED
 */

import { Db } from 'mongodb';
import { buildCoEngagementGraph, getGraphOverlayStatus, type CoEngagementEdge } from './coEngagement.builder.js';

export type EdgeSource = 'mock' | 'live_follow' | 'live_co_engagement';
export type OverlayMode = 'mock_only' | 'live_only' | 'blended';

export interface OverlayEdge {
  from_id: string;
  to_id: string;
  from_username?: string;
  to_username?: string;
  weight: number;
  confidence: number;
  source: EdgeSource;
  style: {
    color: string;      // gray / blue / green
    opacity: number;    // Based on confidence
    dashed: boolean;    // True if confidence < threshold
  };
}

export interface GraphOverlayResult {
  success: boolean;
  mode: OverlayMode;
  edges: OverlayEdge[];
  sources: {
    mock: { enabled: boolean; edge_count: number };
    live_follow: { enabled: boolean; edge_count: number; reason?: string };
    live_co_engagement: { enabled: boolean; edge_count: number };
  };
  stats: {
    total_edges: number;
    by_source: Record<string, number>;
    avg_confidence: number;
  };
  warnings: string[];
}

const CONFIDENCE_THRESHOLD = 0.5;

/**
 * Build graph overlay from available sources
 */
export async function buildGraphOverlay(
  db: Db,
  mode: OverlayMode = 'blended',
  options?: { max_edges?: number }
): Promise<GraphOverlayResult> {
  const maxEdges = options?.max_edges || 200;

  const result: GraphOverlayResult = {
    success: false,
    mode,
    edges: [],
    sources: {
      mock: { enabled: false, edge_count: 0 },
      live_follow: { enabled: false, edge_count: 0, reason: 'Follow data not available' },
      live_co_engagement: { enabled: false, edge_count: 0 },
    },
    stats: { total_edges: 0, by_source: {}, avg_confidence: 0 },
    warnings: [],
  };

  try {
    const allEdges: OverlayEdge[] = [];

    // Mock edges (simulated for now)
    if (mode === 'mock_only' || mode === 'blended') {
      const mockEdges = generateMockEdges(10);
      allEdges.push(...mockEdges);
      result.sources.mock = { enabled: true, edge_count: mockEdges.length };
    }

    // Live follow edges - DISABLED
    result.sources.live_follow = {
      enabled: false,
      edge_count: 0,
      reason: 'Twitter parser does not collect follow relationships',
    };

    // Co-engagement edges
    if (mode === 'live_only' || mode === 'blended') {
      const coEngResult = await buildCoEngagementGraph(db, { max_edges: maxEdges });
      
      if (coEngResult.success && coEngResult.edges.length > 0) {
        const coEngEdges = coEngResult.edges.map(mapCoEngEdgeToOverlay);
        allEdges.push(...coEngEdges);
        result.sources.live_co_engagement = { enabled: true, edge_count: coEngEdges.length };
      }
      
      result.warnings.push(...coEngResult.warnings);
    }

    // Sort and limit
    allEdges.sort((a, b) => b.confidence - a.confidence);
    result.edges = allEdges.slice(0, maxEdges);

    // Calculate stats
    result.stats.total_edges = result.edges.length;
    result.stats.by_source = result.edges.reduce((acc: Record<string, number>, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {});
    result.stats.avg_confidence = result.edges.length > 0
      ? result.edges.reduce((sum, e) => sum + e.confidence, 0) / result.edges.length
      : 0;

    result.success = true;
    console.log(`[GraphOverlay] Built ${result.stats.total_edges} edges in ${mode} mode`);
  } catch (err: any) {
    result.warnings.push(`Build failed: ${err.message}`);
    console.error('[GraphOverlay] Error:', err.message);
  }

  return result;
}

/**
 * Map co-engagement edge to overlay format
 */
function mapCoEngEdgeToOverlay(edge: CoEngagementEdge): OverlayEdge {
  return {
    from_id: edge.from_id,
    to_id: edge.to_id,
    from_username: edge.from_username,
    to_username: edge.to_username,
    weight: edge.weight,
    confidence: edge.confidence,
    source: 'live_co_engagement',
    style: {
      color: '#3B82F6',  // Blue
      opacity: Math.max(0.3, edge.confidence),
      dashed: edge.confidence < CONFIDENCE_THRESHOLD,
    },
  };
}

/**
 * Generate mock edges (placeholder)
 */
function generateMockEdges(count: number): OverlayEdge[] {
  const edges: OverlayEdge[] = [];
  
  // Simple mock edges between common patterns
  const mockPairs = [
    ['ng_001', 'ng_002'],
    ['ng_002', 'ng_003'],
    ['ng_001', 'ng_003'],
    ['br_001', 'br_002'],
    ['sn_001', 'sn_002'],
    ['sn_002', 'sn_003'],
  ];

  for (let i = 0; i < Math.min(count, mockPairs.length); i++) {
    edges.push({
      from_id: mockPairs[i][0],
      to_id: mockPairs[i][1],
      weight: 0.5 + Math.random() * 0.3,
      confidence: 0.8,
      source: 'mock',
      style: {
        color: '#6B7280',  // Gray
        opacity: 0.8,
        dashed: false,
      },
    });
  }

  return edges;
}

export { getGraphOverlayStatus };
