/**
 * Truth Graph Types
 * 
 * PHASE H: Graph of causality, not social graph
 * Actor → Event → Asset → Outcome with cross-connections
 */

// Node types in the graph
export type TruthNodeType = 'ACTOR' | 'EVENT' | 'ASSET' | 'OUTCOME';

// Edge types connecting nodes
export type TruthEdgeType = 
  | 'PUBLISHED'       // Actor → Event
  | 'AFFECTS'         // Event → Asset
  | 'CONFIRMED_BY'    // Event → Outcome
  | 'PRECEDES'        // Event → Event (temporal)
  | 'CORRELATED_WITH' // Actor → Actor (behavioral similarity)
  | 'AMPLIFIES';      // Actor → Actor (one confirms another)

// Outcome verdict
export type OutcomeVerdict = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'VOLATILE';

/**
 * Base node in the graph
 */
export interface TruthNode {
  id: string;
  type: TruthNodeType;
  label: string;
  metadata?: Record<string, any>;
}

/**
 * Actor node
 */
export interface ActorNode extends TruthNode {
  type: 'ACTOR';
  handle: string;
  avgIPS: number;
  totalEvents: number;
  verdict: 'INFORMED' | 'MIXED' | 'NOISE' | 'INSUFFICIENT_DATA';
  influence: number; // 0-1
}

/**
 * Event node (Twitter event)
 */
export interface EventNode extends TruthNode {
  type: 'EVENT';
  actorId: string;
  asset: string;
  timestamp: number;
  ips: number;
  outcome: string;
  window: '1h' | '4h' | '24h';
}

/**
 * Asset node
 */
export interface AssetNode extends TruthNode {
  type: 'ASSET';
  symbol: string;
  totalEvents: number;
  avgOutcomeStrength: number;
}

/**
 * Outcome node
 */
export interface OutcomeNode extends TruthNode {
  type: 'OUTCOME';
  verdict: OutcomeVerdict;
  priceDelta: number;
  timestamp: number;
  window: string;
}

/**
 * Edge in the graph
 */
export interface TruthEdge {
  id: string;
  source: string;      // Node ID
  target: string;      // Node ID
  type: TruthEdgeType;
  weight: number;      // 0-1, truth weight
  metadata?: {
    ips?: number;
    timeProximity?: number;
    outcomeStrength?: number;
    correlation?: number;
  };
}

/**
 * Truth weight calculation result
 */
export interface TruthWeight {
  raw: number;
  normalized: number;  // 0-1
  factors: {
    ips: number;
    timeProximity: number;
    outcomeStrength: number;
  };
}

/**
 * Graph query result
 */
export interface TruthGraphResult {
  nodes: TruthNode[];
  edges: TruthEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    avgTruthWeight: number;
  };
}

/**
 * Actor correlation
 */
export interface ActorCorrelation {
  actor1: string;
  actor2: string;
  correlationType: 'AMPLIFIES' | 'PRECEDES' | 'CORRELATED_WITH';
  strength: number;     // 0-1
  sharedAssets: string[];
  eventOverlap: number; // percentage of events on same assets
  timeAlignment: number; // how often they post in similar windows
}

/**
 * Asset influence path
 */
export interface AssetInfluencePath {
  asset: string;
  topActors: Array<{
    actorId: string;
    avgIPS: number;
    eventCount: number;
    confirmationRate: number;
  }>;
  avgTimeToOutcome: number;
  totalConfirmedEvents: number;
}

/**
 * Truth Graph query parameters
 */
export interface TruthGraphQuery {
  // Filters
  actorIds?: string[];
  assets?: string[];
  window?: '1h' | '4h' | '24h';
  minIPS?: number;
  minTruthWeight?: number;
  verdict?: string[];
  
  // Time range
  from?: number;
  to?: number;
  
  // Graph options
  maxNodes?: number;
  maxEdges?: number;
  includeCorrelations?: boolean;
  depth?: number; // How many hops from seed nodes
}
