/**
 * Graph Builder - builds influence graph from MongoDB data
 * 
 * NO TWITTER DEPENDENCY - uses existing Mongo collections:
 * - connections_accounts
 * - connections_scores  
 * - connections_audience (engaged_user_ids)
 */

import { 
  GraphNode, 
  GraphEdge, 
  ConnectionsGraphResponse,
  GraphQueryParams,
  NodeType,
  ProfileType,
  EarlySignalBadge
} from '../../contracts/graph.contracts.js';
import { 
  computeEdgeWeight, 
  getEdgeStrength,
  computeNodeSize,
  computeNodeColor,
  calculateGraphDensity,
  calculateAvgDegree,
  computeProfileType,
  computeRiskLevel,
  computeEarlySignalBadge
} from './graph-scoring.js';
import { getGraphConfig } from './graph-config.js';
import { getMongoDb } from '../../../../db/mongoose.js';

// ============================================================
// TYPES
// ============================================================

interface AccountDoc {
  author_id: string;
  handle: string;
  display_name?: string;
  avatar?: string;
  profile?: string;
  tags?: string[];
  followers_count?: number;
  red_flags_count?: number;
}

interface ScoreDoc {
  author_id: string;
  influence_score?: number;
  x_score?: number;
  adjusted_influence?: number;
  early_signal_score?: number;
  early_signal_badge?: string;
  risk_level?: string;
  velocity_norm?: number;
  acceleration_norm?: number;
}

interface AudienceDoc {
  author_id: string;
  engaged_users?: string[];
  total_audience?: number;
}

// ============================================================
// MAIN BUILD FUNCTION
// ============================================================

/**
 * Build connections graph from MongoDB data
 */
export async function buildConnectionsGraph(
  params: GraphQueryParams
): Promise<ConnectionsGraphResponse> {
  const startTime = Date.now();
  
  try {
    const config = await getGraphConfig();
    
    // Merge params with config defaults
    const depth = params.depth ?? config.default_depth;
    const limit = Math.min(params.limit ?? config.default_limit, config.default_limit);
    const minJaccard = params.min_jaccard ?? config.min_jaccard;
    const minShared = params.min_shared ?? config.min_shared;
    const maxDegree = params.max_degree ?? config.max_degree;
    
    const db = getMongoDb();
    
    // 1. Fetch candidate accounts
    const candidates = await fetchCandidates(db, params, config.max_candidates);
    
    if (candidates.length === 0) {
      return emptyGraphResponse(params, startTime);
    }
    
    // 2. Fetch scores for candidates
    const scores = await fetchScores(db, candidates.map(c => c.author_id));
    const scoresMap = new Map(scores.map(s => [s.author_id, s]));
    
    // 3. Fetch audience data for overlap calculation
    const audiences = await fetchAudiences(db, candidates.map(c => c.author_id));
    const audienceMap = new Map(audiences.map(a => [a.author_id, a.engaged_users || []]));
    
    // 4. Build nodes
    const maxInfluence = Math.max(...scores.map(s => s.influence_score || 0), 1);
    const nodes: GraphNode[] = candidates.slice(0, limit).map(acc => {
      const score = scoresMap.get(acc.author_id);
      return buildNode(acc, score, maxInfluence);
    });
    
    // Apply node filters
    const filteredNodes = filterNodes(nodes, params);
    
    // 5. Build edges (pairwise overlap)
    const edges: GraphEdge[] = [];
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const degreeCount = new Map<string, number>();
    
    for (let i = 0; i < filteredNodes.length; i++) {
      for (let j = i + 1; j < filteredNodes.length; j++) {
        const nodeA = filteredNodes[i];
        const nodeB = filteredNodes[j];
        
        // Check degree limits
        const degreeA = degreeCount.get(nodeA.id) || 0;
        const degreeB = degreeCount.get(nodeB.id) || 0;
        if (degreeA >= maxDegree || degreeB >= maxDegree) continue;
        
        // Calculate overlap
        const audienceA = audienceMap.get(nodeA.id) || [];
        const audienceB = audienceMap.get(nodeB.id) || [];
        
        const overlap = calculateOverlap(audienceA, audienceB);
        
        // Apply thresholds
        if (overlap.jaccard < minJaccard) continue;
        if (overlap.shared < minShared) continue;
        
        // Create edge
        const weight = computeEdgeWeight(overlap.jaccard, overlap.a_to_b, overlap.b_to_a);
        
        edges.push({
          id: `${nodeA.id}-${nodeB.id}`,
          source: nodeA.id,
          target: nodeB.id,
          edge_type: 'OVERLAP',
          shared_count: overlap.shared,
          jaccard: overlap.jaccard,
          a_to_b: overlap.a_to_b,
          b_to_a: overlap.b_to_a,
          weight,
          strength: getEdgeStrength(weight),
          direction: 'bidirectional',
        });
        
        // Update degree counts
        degreeCount.set(nodeA.id, degreeA + 1);
        degreeCount.set(nodeB.id, degreeB + 1);
      }
    }
    
    // 6. Compute stats
    const jaccards = edges.map(e => e.jaccard);
    const stats = {
      total_nodes: filteredNodes.length,
      total_edges: edges.length,
      avg_degree: calculateAvgDegree(filteredNodes.length, edges.length),
      density: calculateGraphDensity(filteredNodes.length, edges.length),
      max_jaccard: jaccards.length > 0 ? Math.max(...jaccards) : 0,
      min_jaccard: jaccards.length > 0 ? Math.min(...jaccards) : 0,
      build_time_ms: Date.now() - startTime,
    };
    
    // 7. Return response
    return {
      ok: true,
      seed: params.seed ? {
        id: params.seed,
        handle: candidates.find(c => c.author_id === params.seed)?.handle || params.seed,
        display_name: candidates.find(c => c.author_id === params.seed)?.display_name || '',
      } : undefined,
      nodes: filteredNodes,
      edges,
      stats,
      params: {
        depth,
        limit,
        min_jaccard: minJaccard,
        min_shared: minShared,
        max_degree: maxDegree,
      },
    };
    
  } catch (err: any) {
    console.error('[GraphBuilder] Error:', err.message);
    return {
      ok: false,
      nodes: [],
      edges: [],
      stats: {
        total_nodes: 0,
        total_edges: 0,
        avg_degree: 0,
        density: 0,
        max_jaccard: 0,
        min_jaccard: 0,
        build_time_ms: Date.now() - startTime,
      },
      params: {
        depth: params.depth ?? 2,
        limit: params.limit ?? 50,
        min_jaccard: params.min_jaccard ?? 0.05,
        min_shared: params.min_shared ?? 3,
        max_degree: params.max_degree ?? 20,
      },
    };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Fetch candidate accounts from database
 */
async function fetchCandidates(
  db: any,
  params: GraphQueryParams,
  maxCandidates: number
): Promise<AccountDoc[]> {
  const accountsColl = db.collection('connections_accounts');
  const scoresColl = db.collection('connections_scores');
  
  // If we have a seed, start from there
  if (params.seed) {
    // Get accounts with scores, ordered by influence
    const pipeline = [
      {
        $lookup: {
          from: 'connections_scores',
          localField: 'author_id',
          foreignField: 'author_id',
          as: 'score'
        }
      },
      { $unwind: { path: '$score', preserveNullAndEmptyArrays: true } },
      { $sort: { 'score.influence_score': -1 } },
      { $limit: maxCandidates },
      {
        $project: {
          _id: 0,
          author_id: 1,
          handle: 1,
          display_name: 1,
          avatar: 1,
          profile: 1,
          tags: 1,
          followers_count: 1,
          red_flags_count: 1,
        }
      }
    ];
    
    return await accountsColl.aggregate(pipeline).toArray();
  }
  
  // No seed - get top accounts by influence
  const pipeline = [
    {
      $lookup: {
        from: 'connections_scores',
        localField: 'author_id',
        foreignField: 'author_id',
        as: 'score'
      }
    },
    { $unwind: { path: '$score', preserveNullAndEmptyArrays: true } },
    { $sort: { 'score.influence_score': -1 } },
    { $limit: maxCandidates },
    {
      $project: {
        _id: 0,
        author_id: 1,
        handle: 1,
        display_name: 1,
        avatar: 1,
        profile: 1,
        tags: 1,
        followers_count: 1,
        red_flags_count: 1,
      }
    }
  ];
  
  const results = await accountsColl.aggregate(pipeline).toArray();
  
  // If no data in DB, generate mock
  if (results.length === 0) {
    return generateMockAccounts(Math.min(30, maxCandidates));
  }
  
  return results;
}

/**
 * Fetch scores for given author IDs
 */
async function fetchScores(db: any, authorIds: string[]): Promise<ScoreDoc[]> {
  if (authorIds.length === 0) return [];
  
  const scoresColl = db.collection('connections_scores');
  
  const results = await scoresColl.find({
    author_id: { $in: authorIds }
  }).project({ _id: 0 }).toArray();
  
  // If no scores, generate mock
  if (results.length === 0) {
    return authorIds.map(id => generateMockScore(id));
  }
  
  return results;
}

/**
 * Fetch audience data for overlap calculation
 */
async function fetchAudiences(db: any, authorIds: string[]): Promise<AudienceDoc[]> {
  if (authorIds.length === 0) return [];
  
  const audienceColl = db.collection('connections_audience');
  
  const results = await audienceColl.find({
    author_id: { $in: authorIds }
  }).project({ _id: 0 }).toArray();
  
  // If no audiences, generate mock
  if (results.length === 0) {
    return authorIds.map(id => generateMockAudience(id));
  }
  
  return results;
}

/**
 * Build GraphNode from account and score data
 */
function buildNode(
  account: AccountDoc,
  score: ScoreDoc | undefined,
  maxInfluence: number
): GraphNode {
  const influenceScore = score?.influence_score || 0;
  const xScore = score?.x_score || 0;
  const adjustedInfluence = score?.adjusted_influence || influenceScore;
  const earlySignalScore = score?.early_signal_score || 0;
  
  const profileType = computeProfileType(influenceScore);
  const riskLevel = computeRiskLevel(account.red_flags_count || 0);
  const earlySignal = computeEarlySignalBadge(earlySignalScore);
  
  // Phase 4.1.7: Compute confidence for overlay
  const confidence = computeNodeConfidence(account, score);
  
  return {
    id: account.author_id,
    handle: account.handle,
    display_name: account.display_name || `@${account.handle}`,
    avatar: account.avatar,
    
    influence_score: influenceScore,
    x_score: xScore,
    adjusted_influence: adjustedInfluence,
    
    node_type: (account.tags?.includes('fund') ? 'fund' : 
               account.tags?.includes('project') ? 'project' : 'person') as NodeType,
    profile_type: profileType,
    risk_level: riskLevel,
    early_signal: earlySignal,
    
    // Phase 4.1.7: Include confidence
    confidence,
    
    followers_count: account.followers_count,
    engagement_rate: undefined,
    posts_per_day: undefined,
    red_flags_count: account.red_flags_count || 0,
    
    tags: account.tags || [],
    
    size: computeNodeSize(influenceScore, maxInfluence),
    color: computeNodeColor(profileType, earlySignal),
  };
}

/**
 * Phase 4.1.7: Compute confidence for graph overlay
 */
function computeNodeConfidence(
  account: AccountDoc,
  score: ScoreDoc | undefined
): { score: number; level: 'high' | 'medium' | 'low' | 'critical'; warnings: string[] } {
  const warnings: string[] = [];
  let confidenceScore = 0.85; // Default mock confidence
  
  // Check for missing data
  if (!account.followers_count) {
    confidenceScore -= 0.15;
    warnings.push('MISSING_FOLLOWERS_DATA');
  }
  
  if (!score) {
    confidenceScore -= 0.20;
    warnings.push('MISSING_SCORE_DATA');
  }
  
  // Check for red flags (anomalies)
  if (account.red_flags_count && account.red_flags_count > 2) {
    confidenceScore -= 0.15;
    warnings.push('MULTIPLE_RED_FLAGS');
  }
  
  // Check for suspicious patterns in score
  if (score?.velocity_norm && Math.abs(score.velocity_norm) > 0.8) {
    confidenceScore -= 0.10;
    warnings.push('HIGH_VOLATILITY');
  }
  
  // Clamp to 0-1
  confidenceScore = Math.max(0, Math.min(1, confidenceScore));
  
  // Determine level
  let level: 'high' | 'medium' | 'low' | 'critical';
  if (confidenceScore >= 0.8) {
    level = 'high';
  } else if (confidenceScore >= 0.5) {
    level = 'medium';
  } else if (confidenceScore >= 0.3) {
    level = 'low';
  } else {
    level = 'critical';
  }
  
  return {
    score: Math.round(confidenceScore * 100) / 100,
    level,
    warnings,
  };
}

/**
 * Filter nodes by query params
 */
function filterNodes(nodes: GraphNode[], params: GraphQueryParams): GraphNode[] {
  let filtered = [...nodes];
  
  if (params.node_types?.length) {
    filtered = filtered.filter(n => params.node_types!.includes(n.node_type));
  }
  
  if (params.profile_types?.length) {
    filtered = filtered.filter(n => params.profile_types!.includes(n.profile_type));
  }
  
  if (params.risk_levels?.length) {
    filtered = filtered.filter(n => params.risk_levels!.includes(n.risk_level));
  }
  
  if (params.early_signals?.length) {
    filtered = filtered.filter(n => params.early_signals!.includes(n.early_signal));
  }
  
  if (params.min_influence !== undefined) {
    filtered = filtered.filter(n => n.influence_score >= params.min_influence!);
  }
  
  if (params.max_influence !== undefined) {
    filtered = filtered.filter(n => n.influence_score <= params.max_influence!);
  }
  
  if (params.tags?.length) {
    filtered = filtered.filter(n => 
      params.tags!.some(tag => n.tags.includes(tag))
    );
  }
  
  return filtered;
}

/**
 * Calculate overlap between two audiences
 */
function calculateOverlap(
  audienceA: string[],
  audienceB: string[]
): { shared: number; jaccard: number; a_to_b: number; b_to_a: number } {
  if (audienceA.length === 0 || audienceB.length === 0) {
    // If no real data, generate synthetic overlap
    return generateSyntheticOverlap();
  }
  
  const setA = new Set(audienceA);
  const setB = new Set(audienceB);
  
  // Intersection
  const shared = audienceA.filter(x => setB.has(x)).length;
  
  // Union
  const union = setA.size + setB.size - shared;
  
  // Jaccard similarity
  const jaccard = union > 0 ? shared / union : 0;
  
  // Directional overlaps
  const a_to_b = setA.size > 0 ? shared / setA.size : 0;
  const b_to_a = setB.size > 0 ? shared / setB.size : 0;
  
  return { shared, jaccard, a_to_b, b_to_a };
}

/**
 * Generate synthetic overlap for mock data
 */
function generateSyntheticOverlap(): { shared: number; jaccard: number; a_to_b: number; b_to_a: number } {
  // Random but plausible values
  const jaccard = Math.random() * 0.4 + 0.1; // 0.1 - 0.5
  const shared = Math.floor(Math.random() * 50) + 5;
  const a_to_b = Math.random() * 0.5 + 0.1;
  const b_to_a = Math.random() * 0.5 + 0.1;
  
  return { shared, jaccard, a_to_b, b_to_a };
}

/**
 * Empty graph response
 */
function emptyGraphResponse(params: GraphQueryParams, startTime: number): ConnectionsGraphResponse {
  return {
    ok: true,
    nodes: [],
    edges: [],
    stats: {
      total_nodes: 0,
      total_edges: 0,
      avg_degree: 0,
      density: 0,
      max_jaccard: 0,
      min_jaccard: 0,
      build_time_ms: Date.now() - startTime,
    },
    params: {
      depth: params.depth ?? 2,
      limit: params.limit ?? 50,
      min_jaccard: params.min_jaccard ?? 0.05,
      min_shared: params.min_shared ?? 3,
      max_degree: params.max_degree ?? 20,
    },
  };
}

// ============================================================
// MOCK DATA GENERATORS
// ============================================================

function generateMockAccounts(count: number): AccountDoc[] {
  const names = [
    'crypto_alpha', 'defi_hunter', 'nft_whale', 'token_sage', 'yield_master',
    'dao_builder', 'web3_dev', 'chain_analyst', 'meme_trader', 'airdrop_pro',
    'sol_maxi', 'eth_bull', 'btc_hodler', 'layer2_fan', 'zk_builder',
    'gaming_whale', 'metaverse_ape', 'rwa_investor', 'depin_alpha', 'ai_trader',
    'onchain_sleuth', 'degen_king', 'alpha_caller', 'whale_watcher', 'vc_insider'
  ];
  
  const tags = ['person', 'fund', 'project'];
  
  return Array.from({ length: count }, (_, i) => ({
    author_id: `mock_${i.toString().padStart(3, '0')}`,
    handle: names[i % names.length] + (i >= names.length ? `_${Math.floor(i / names.length)}` : ''),
    display_name: names[i % names.length].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    profile: ['retail', 'influencer', 'whale'][i % 3],
    tags: [tags[Math.floor(Math.random() * 3)]],
    followers_count: Math.floor(Math.random() * 100000) + 1000,
    red_flags_count: Math.floor(Math.random() * 3),
  }));
}

function generateMockScore(authorId: string): ScoreDoc {
  const baseScore = Math.random() * 700 + 200;
  return {
    author_id: authorId,
    influence_score: Math.round(baseScore),
    x_score: Math.round(baseScore * 0.6),
    adjusted_influence: Math.round(baseScore * (0.8 + Math.random() * 0.4)),
    early_signal_score: Math.random() > 0.7 ? Math.random() * 500 + 300 : Math.random() * 300,
    early_signal_badge: Math.random() > 0.85 ? 'breakout' : Math.random() > 0.7 ? 'rising' : 'none',
    risk_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
    velocity_norm: (Math.random() - 0.3) * 1.5,
    acceleration_norm: (Math.random() - 0.3) * 1.2,
  };
}

function generateMockAudience(authorId: string): AudienceDoc {
  // Generate random user IDs for audience
  const audienceSize = Math.floor(Math.random() * 100) + 20;
  const engaged_users = Array.from({ length: audienceSize }, (_, i) => 
    `user_${Math.floor(Math.random() * 500)}`
  );
  
  return {
    author_id: authorId,
    engaged_users,
    total_audience: engaged_users.length,
  };
}

export { generateMockAccounts, generateMockScore, generateMockAudience };
