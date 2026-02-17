/**
 * Graph Overlay Builder (Phase 4.4)
 * 
 * Builds overlay graph combining mock and live data.
 * 
 * Key principles:
 * - Read-only from twitter_results (via Phase 4.2 reader)
 * - NO writes to Twitter parser
 * - Blend formula: weight = mock * (1-w) + live * w
 */

import type { 
  ConnectionsGraphResponse, 
  GraphNode, 
  GraphEdge 
} from '../../contracts/graph.contracts.js';
import type {
  GraphOverlayConfig,
  GraphOverlayNodeMeta,
  GraphOverlayEdgeMeta,
  ConnectionsGraphOverlayResponse,
  GraphOverlayStats,
  OverlaySource,
  OverlayStatus
} from '../../contracts/graph-overlay.contracts.js';
import { DEFAULT_GRAPH_OVERLAY_CONFIG } from '../../contracts/graph-overlay.contracts.js';
import { getGraphOverlayConfig } from './graph-overlay.config.js';
import { readTwitterLiveData } from '../../twitter-live/reader.js';
import { getParticipationConfig } from '../../twitter-live/participation.config.js';
import { getMongoDb } from '../../../../db/mongoose.js';

interface LiveEdge {
  from: string;
  to: string;
  strength?: number;
}

/**
 * Helper: Create edge key
 */
function edgeKey(a: string, b: string): string {
  return `${a}→${b}`;
}

/**
 * Helper: Clamp to 0-1
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Helper: Value to percentage
 */
function pct(x: number): number {
  return Math.round(clamp01(x) * 100);
}

/**
 * Read live follow edges from twitter_results (via Phase 4.2)
 */
async function readLiveFollowEdges(): Promise<LiveEdge[]> {
  try {
    const db = getMongoDb();
    const liveData = await readTwitterLiveData(db, { limit: 500 });
    
    // Convert from Phase 4.2 format
    return liveData.edges.map(e => ({
      from: e.from_id,
      to: e.to_id,
      strength: e.weight,
    }));
  } catch (err) {
    console.log('[GraphOverlay] No live edges available:', err);
    return [];
  }
}

/**
 * Build graph overlay
 */
export async function buildGraphOverlay(
  baseGraph: ConnectionsGraphResponse,
  configOverride?: Partial<GraphOverlayConfig>
): Promise<ConnectionsGraphOverlayResponse> {
  const cfg = {
    ...(await getGraphOverlayConfig()),
    ...(configOverride || {}),
  };
  
  const participation = getParticipationConfig();
  const graphEdgesWeight = participation.components.graph_edges.enabled 
    ? (participation.components.graph_edges.effective_weight ?? participation.components.graph_edges.weight)
    : 0;
  const wBlend = clamp01(graphEdgesWeight / 100);
  
  // If disabled or mock-only, return base graph with mock overlay
  if (!cfg.enabled || cfg.mode === 'mock') {
    return wrapAsMockOverlay(baseGraph, cfg);
  }
  
  // Read live edges
  const liveEdges = await readLiveFollowEdges();
  const liveEdgeMap = new Map<string, { w?: number }>();
  
  for (const e of liveEdges) {
    if (!e.from || !e.to) continue;
    liveEdgeMap.set(edgeKey(e.from, e.to), {
      w: e.strength != null ? clamp01(e.strength) : undefined,
    });
  }
  
  // Annotate nodes
  const nodeMap = new Map<string, GraphNode>();
  for (const n of baseGraph.nodes) {
    const confidence = n.confidence?.score ? Math.round(n.confidence.score * 100) : 80;
    const livePresent = liveEdgeMap.has(edgeKey(n.id, 'any')) || 
                        Array.from(liveEdgeMap.keys()).some(k => k.includes(n.id));
    
    (n as any).overlay = {
      source: cfg.mode === 'mock' ? 'mock' : (livePresent ? 'both' : 'mock'),
      live_present: livePresent,
      confidence,
    } as GraphOverlayNodeMeta;
    
    nodeMap.set(n.id, n);
  }
  
  // Build mock edge map
  const mockEdgeMap = new Map<string, GraphEdge>();
  for (const e of baseGraph.edges) {
    mockEdgeMap.set(edgeKey(String(e.source), String(e.target)), e);
  }
  
  // Union edges
  const allKeys = new Set<string>([...mockEdgeMap.keys(), ...liveEdgeMap.keys()]);
  const newEdges: GraphEdge[] = [];
  let hidden = 0, edgesLive = 0, edgesBoth = 0, divergent = 0;
  let confSum = 0, confCnt = 0;
  let nodesLive = 0;
  
  // Count live nodes
  for (const n of baseGraph.nodes) {
    if ((n as any).overlay?.live_present) nodesLive++;
  }
  
  for (const k of allKeys) {
    const eMock = mockEdgeMap.get(k);
    const eLive = liveEdgeMap.get(k);
    
    // Live-only mode: skip mock-only edges
    if (cfg.mode === 'live' && !eLive) continue;
    
    const [a, b] = k.split('→');
    const nA = nodeMap.get(a);
    const nB = nodeMap.get(b);
    
    // Calculate confidence
    const confA = (nA as any)?.overlay?.confidence ?? 70;
    const confB = (nB as any)?.overlay?.confidence ?? 70;
    const edgeConfProxy = eLive?.w != null ? pct(eLive.w) : 70;
    const confidence = Math.min(confA, confB, edgeConfProxy);
    
    // Hide low confidence if not enabled
    if (!cfg.show_low_confidence && confidence < cfg.min_edge_confidence) {
      hidden++;
      continue;
    }
    
    confSum += confidence;
    confCnt++;
    
    // Get weights
    const wMock = typeof eMock?.weight === 'number' ? clamp01(eMock.weight) : 0.4;
    const wLive = eLive?.w != null ? clamp01(eLive.w) : undefined;
    
    // Determine source
    let source: OverlaySource = eMock && eLive ? 'both' : (eLive ? 'live' : 'mock');
    if (eLive) edgesLive++;
    if (source === 'both') edgesBoth++;
    
    // Determine status
    let status: OverlayStatus = 'confirmed';
    if (source === 'both' && wLive != null) {
      const delta = Math.abs(wLive - wMock);
      if (delta > cfg.divergence_threshold) {
        status = 'divergent';
        divergent++;
      }
    }
    if (source === 'live' && wLive != null && wLive < 0.2) status = 'weak';
    if (source === 'mock' && wMock < 0.2) status = 'weak';
    
    // Hide divergent if not enabled
    if (!cfg.show_divergent && status === 'divergent') {
      hidden++;
      continue;
    }
    
    // Calculate final weight based on mode
    let finalWeight = wMock;
    if (cfg.mode === 'live' && wLive != null) {
      finalWeight = wLive;
    } else if (cfg.mode === 'blended') {
      const liveVal = wLive ?? 0;
      finalWeight = clamp01(wMock * (1 - wBlend) + liveVal * wBlend);
    } else if (cfg.mode === 'live' && wLive == null) {
      finalWeight = 0.3;
    }
    
    // Build edge object
    const edgeObj: GraphEdge = eMock 
      ? { ...eMock, weight: finalWeight }
      : {
          id: k,
          source: a,
          target: b,
          edge_type: 'FOLLOW' as any,
          shared_count: 0,
          jaccard: 0,
          a_to_b: 0,
          b_to_a: 0,
          weight: finalWeight,
          strength: 'medium' as any,
          direction: 'bidirectional' as any,
        };
    
    // Add overlay metadata
    (edgeObj as any).overlay = {
      source,
      status,
      confidence,
      weight_mock: Math.round(wMock * 100) / 100,
      weight_live: wLive != null ? Math.round(wLive * 100) / 100 : undefined,
      signals: source !== 'mock' ? ['follow_edge'] : ['overlap_proxy'],
      risk_flags: confidence < 70 ? ['LOW_CONF'] : [],
    } as GraphOverlayEdgeMeta;
    
    newEdges.push(edgeObj);
  }
  
  const stats: GraphOverlayStats = {
    nodes_total: baseGraph.nodes.length,
    nodes_live: nodesLive,
    edges_total: newEdges.length,
    edges_live: edgesLive,
    edges_both: edgesBoth,
    edges_divergent: divergent,
    avg_confidence: confCnt ? Math.round(confSum / confCnt) : 0,
    hidden_edges: hidden,
  };
  
  return {
    version: '1.0',
    mode: cfg.mode,
    stats,
    graph: {
      ...baseGraph,
      edges: newEdges,
    },
  };
}

/**
 * Wrap as mock overlay (no live data)
 */
function wrapAsMockOverlay(
  baseGraph: ConnectionsGraphResponse,
  cfg: GraphOverlayConfig
): ConnectionsGraphOverlayResponse {
  // Add mock overlay metadata to all edges
  const edges = baseGraph.edges.map(e => ({
    ...e,
    overlay: {
      source: 'mock' as OverlaySource,
      status: 'confirmed' as OverlayStatus,
      confidence: 80,
      weight_mock: e.weight,
      weight_live: undefined,
      signals: ['overlap_proxy'],
      risk_flags: [],
    } as GraphOverlayEdgeMeta,
  }));
  
  // Add mock overlay metadata to all nodes
  const nodes = baseGraph.nodes.map(n => ({
    ...n,
    overlay: {
      source: 'mock' as OverlaySource,
      live_present: false,
      confidence: n.confidence?.score ? Math.round(n.confidence.score * 100) : 80,
    } as GraphOverlayNodeMeta,
  }));
  
  return {
    version: '1.0',
    mode: 'mock',
    stats: {
      nodes_total: nodes.length,
      nodes_live: 0,
      edges_total: edges.length,
      edges_live: 0,
      edges_both: 0,
      edges_divergent: 0,
      avg_confidence: 80,
      hidden_edges: 0,
    },
    graph: {
      ...baseGraph,
      nodes,
      edges,
    },
  };
}

/**
 * Get overlay explain for an edge
 */
export async function getEdgeOverlayExplain(edgeId: string): Promise<{
  ok: boolean;
  edge_id: string;
  reason: string;
  confidence: number;
  signals: string[];
  risk_flags: string[];
  recommendation: string;
}> {
  // For now, return generic explain
  // In full implementation, would look up actual edge data
  return {
    ok: true,
    edge_id: edgeId,
    reason: 'Edge exists in graph based on audience overlap or follow relationship',
    confidence: 80,
    signals: ['overlap_proxy', 'possible_follow'],
    risk_flags: [],
    recommendation: 'Use confidence and divergence status to validate this connection.',
  };
}
