/**
 * Connections Graph Builder
 * 
 * Builds influence graph from connections data
 * WITHOUT Twitter API - uses calculated/mock overlaps
 */

import { GraphNode, GraphEdge, GraphSnapshot, GraphFilters, ProfileType, RiskLevel, EarlySignal, EdgeStrength, EdgeDirection } from './types.js';

// Weight coefficients for edge strength calculation
const EDGE_WEIGHTS = {
  overlap_score: 0.5,
  score_similarity: 0.3,
  trend_alignment: 0.2
};

/**
 * Calculate edge strength based on multiple factors
 */
function calculateEdgeStrength(
  overlapScore: number,
  scoreSimilarity: number,
  trendAlignment: number
): number {
  return (
    EDGE_WEIGHTS.overlap_score * overlapScore +
    EDGE_WEIGHTS.score_similarity * scoreSimilarity +
    EDGE_WEIGHTS.trend_alignment * trendAlignment
  );
}

/**
 * Determine edge strength category
 */
function getEdgeStrengthCategory(weight: number): EdgeStrength {
  if (weight >= 0.7) return 'high';
  if (weight >= 0.4) return 'medium';
  return 'low';
}

/**
 * Determine edge direction based on influence scores
 */
function getEdgeDirection(scoreA: number, scoreB: number, threshold = 100): EdgeDirection {
  const diff = scoreA - scoreB;
  if (Math.abs(diff) < threshold) return 'mutual';
  return diff > 0 ? 'outbound' : 'inbound';
}

/**
 * Build graph from accounts data
 */
export function buildConnectionsGraph(
  accounts: Array<{
    author_id: string;
    handle: string;
    profile?: ProfileType;
    scores?: {
      influence_score?: number;
      x_score?: number;
      risk_level?: RiskLevel;
    };
    early_signal?: {
      badge?: EarlySignal;
      score?: number;
    };
    trend?: {
      velocity_norm?: number;
      acceleration_norm?: number;
      state?: string;
    };
    audience?: string[];
  }>[],
  filters: GraphFilters = {}
): GraphSnapshot {
  // Apply node filters
  let filteredAccounts = [...accounts];
  
  if (filters.profiles && filters.profiles.length > 0) {
    filteredAccounts = filteredAccounts.filter(a => 
      filters.profiles!.includes(a.profile || 'retail')
    );
  }
  
  if (filters.influence_range) {
    const [min, max] = filters.influence_range;
    filteredAccounts = filteredAccounts.filter(a => {
      const score = a.scores?.influence_score || 0;
      return score >= min && score <= max;
    });
  }
  
  if (filters.risk_level?.length) {
    filteredAccounts = filteredAccounts.filter(a => 
      filters.risk_level!.includes(a.scores?.risk_level || 'low')
    );
  }
  
  if (filters.early_signal?.length) {
    filteredAccounts = filteredAccounts.filter(a => 
      filters.early_signal!.includes(a.early_signal?.badge || 'none')
    );
  }
  
  if (filters.limit_nodes) {
    filteredAccounts = filteredAccounts.slice(0, filters.limit_nodes);
  }
  
  // Build nodes
  const nodes: GraphNode[] = filteredAccounts.map(account => {
    const influenceScore = account.scores?.influence_score || 0;
    const profile = account.profile || 'retail';
    const trendState = account.trend?.velocity_norm ? 
      (account.trend.velocity_norm > 0.2 ? 'growing' : 
       account.trend.velocity_norm < -0.2 ? 'cooling' : 'stable') : 'stable';
    
    return {
      id: account.author_id,
      label: `@${account.handle}`,
      type: 'person' as const,
      profile,
      influence_score: influenceScore,
      x_score: account.scores?.x_score || 0,
      trend_state: trendState as 'growing' | 'stable' | 'cooling' | 'volatile',
      early_signal: (account.early_signal?.badge || 'none') as EarlySignal,
      risk_level: (account.scores?.risk_level || 'low') as RiskLevel,
      size: 10 + (influenceScore / 1000) * 30,
      color: getNodeColor(profile, account.early_signal?.badge || 'none'),
    };
  });
  
  // Build edges (calculated relationships)
  const edges: GraphEdge[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  for (let i = 0; i < filteredAccounts.length; i++) {
    for (let j = i + 1; j < filteredAccounts.length; j++) {
      const accountA = filteredAccounts[i];
      const accountB = filteredAccounts[j];
      
      // Calculate overlap (mock or from audience data)
      const overlap = calculateOverlap(accountA, accountB);
      
      // Calculate score similarity (normalized)
      const scoreA = accountA.scores?.influence_score || 0;
      const scoreB = accountB.scores?.influence_score || 0;
      const maxScore = Math.max(scoreA, scoreB, 1);
      const scoreSimilarity = 1 - Math.abs(scoreA - scoreB) / maxScore;
      
      // Calculate trend alignment
      const velA = accountA.trend?.velocity_norm || 0;
      const velB = accountB.trend?.velocity_norm || 0;
      const trendAlignment = 1 - Math.abs(velA - velB) / 2;
      
      // Calculate edge weight
      const weight = calculateEdgeStrength(overlap, scoreSimilarity, trendAlignment);
      
      // Only create edge if weight is significant
      if (weight >= 0.25) {
        const strength = getEdgeStrengthCategory(weight);
        const direction = getEdgeDirection(scoreA, scoreB);
        
        // Apply edge filters (empty array = no filter)
        if (filters.edge_strength?.length && !filters.edge_strength.includes(strength)) continue;
        if (filters.overlap_min && overlap < filters.overlap_min) continue;
        if (filters.direction?.length && !filters.direction.includes(direction)) continue;
        
        edges.push({
          id: `${accountA.author_id}-${accountB.author_id}`,
          source: accountA.author_id,
          target: accountB.author_id,
          type: overlap > 0.5 ? 'audience_overlap' : 
                Math.abs(velA - velB) < 0.3 ? 'trend_correlation' : 
                'engagement_similarity',
          weight,
          strength,
          direction,
          confidence: Math.min(1, weight + 0.2),
          overlap_percent: overlap * 100,
        });
      }
    }
  }
  
  // Remove isolated nodes if filter is set
  let finalNodes = nodes;
  if (filters.hide_isolated) {
    const connectedIds = new Set<string>();
    edges.forEach(e => {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    });
    finalNodes = nodes.filter(n => connectedIds.has(n.id));
  }
  
  return {
    nodes: finalNodes,
    edges,
    meta: {
      total_nodes: finalNodes.length,
      total_edges: edges.length,
      layout: 'force',
      generated_at: new Date().toISOString(),
      applied_filters: filters,
    }
  };
}

/**
 * Calculate overlap between two accounts
 * Uses audience data if available, otherwise mock calculation
 */
function calculateOverlap(
  accountA: { audience?: string[]; scores?: { influence_score?: number } },
  accountB: { audience?: string[]; scores?: { influence_score?: number } }
): number {
  // If both have audience data, calculate real overlap
  if (accountA.audience?.length && accountB.audience?.length) {
    const setA = new Set(accountA.audience);
    const setB = new Set(accountB.audience);
    const intersection = accountA.audience.filter(x => setB.has(x)).length;
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
  
  // Mock overlap based on score proximity
  const scoreA = accountA.scores?.influence_score || 500;
  const scoreB = accountB.scores?.influence_score || 500;
  const scoreDiff = Math.abs(scoreA - scoreB);
  const maxScore = Math.max(scoreA, scoreB, 1);
  
  // Similar scores = higher chance of audience overlap
  const baseOverlap = Math.max(0, 1 - scoreDiff / maxScore);
  // Add some randomness for variety
  const randomFactor = 0.3 + Math.random() * 0.4;
  
  return baseOverlap * randomFactor;
}

/**
 * Get node color based on profile and signal
 */
function getNodeColor(profile: ProfileType, signal: EarlySignal): string {
  if (signal === 'breakout') return '#22c55e';  // green
  if (signal === 'rising') return '#eab308';    // yellow
  
  switch (profile) {
    case 'whale': return '#6366f1';      // indigo
    case 'influencer': return '#8b5cf6'; // purple
    default: return '#64748b';           // gray
  }
}

export default { buildConnectionsGraph };
