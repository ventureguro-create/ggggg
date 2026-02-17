/**
 * Co-Engagement Graph Builder
 * 
 * Builds network edges from similarity scores.
 * Does NOT write to twitter collections.
 */

import { Db } from 'mongodb';
import { readCoEngagementVectors, type EngagementVector } from '../../adapters/twitter/readers/twitterCoEngagement.reader.js';
import { calculateAllSimilarities, type SimilarityMetric, type SimilarityResult } from './similarity.engine.js';

export interface CoEngagementEdge {
  from_id: string;
  to_id: string;
  from_username?: string;
  to_username?: string;
  weight: number;           // 0-1
  confidence: number;       // 0-1
  metric: SimilarityMetric;
  source: 'CO_ENGAGEMENT';
  created_at: Date;
}

export interface CoEngagementGraphConfig {
  enabled: boolean;
  metric: SimilarityMetric;
  min_similarity_threshold: number;
  max_edges_per_node: number;
  max_total_edges: number;
  confidence_factor: number;  // How much data volume affects confidence
}

export interface CoEngagementGraphResult {
  success: boolean;
  config: CoEngagementGraphConfig;
  edges: CoEngagementEdge[];
  stats: {
    nodes_count: number;
    edges_count: number;
    avg_similarity: number;
    avg_confidence: number;
  };
  warnings: string[];
}

const DEFAULT_CONFIG: CoEngagementGraphConfig = {
  enabled: true,
  metric: 'cosine',
  min_similarity_threshold: 0.3,
  max_edges_per_node: 10,
  max_total_edges: 100,
  confidence_factor: 0.75,  // Cap at 75% without follow graph
};

let graphConfig: CoEngagementGraphConfig = { ...DEFAULT_CONFIG };

export function getCoEngagementConfig(): CoEngagementGraphConfig {
  return { ...graphConfig };
}

export function updateCoEngagementConfig(updates: Partial<CoEngagementGraphConfig>): CoEngagementGraphConfig {
  graphConfig = { ...graphConfig, ...updates };
  return { ...graphConfig };
}

/**
 * Build co-engagement graph
 */
export async function buildCoEngagementGraphV2(db: Db): Promise<CoEngagementGraphResult> {
  const config = getCoEngagementConfig();
  
  const result: CoEngagementGraphResult = {
    success: false,
    config,
    edges: [],
    stats: { nodes_count: 0, edges_count: 0, avg_similarity: 0, avg_confidence: 0 },
    warnings: [],
  };

  if (!config.enabled) {
    result.warnings.push('Co-engagement graph disabled');
    result.success = true;
    return result;
  }

  try {
    // Read vectors
    const vectorResult = await readCoEngagementVectors(db, { max_authors: 50 });
    
    if (!vectorResult.success || vectorResult.vectors.length < 2) {
      result.warnings.push('Not enough data for graph building');
      result.success = true;
      return result;
    }

    // Build username map
    const usernameMap = new Map<string, string>();
    for (const v of vectorResult.vectors) {
      usernameMap.set(v.author_id, v.username);
    }

    // Calculate similarities
    const similarities = calculateAllSimilarities(
      vectorResult.vectors,
      config.metric,
      config.min_similarity_threshold
    );

    // Convert to edges with limits
    const edgeCounts = new Map<string, number>();
    
    for (const sim of similarities) {
      if (result.edges.length >= config.max_total_edges) break;
      
      const fromCount = edgeCounts.get(sim.from_id) || 0;
      const toCount = edgeCounts.get(sim.to_id) || 0;
      
      if (fromCount >= config.max_edges_per_node || toCount >= config.max_edges_per_node) {
        continue;
      }

      // Calculate confidence based on data volume
      const fromVector = vectorResult.vectors.find(v => v.author_id === sim.from_id);
      const toVector = vectorResult.vectors.find(v => v.author_id === sim.to_id);
      const dataVolume = ((fromVector?.tweet_count || 0) + (toVector?.tweet_count || 0)) / 100;
      const confidence = Math.min(config.confidence_factor, sim.similarity * dataVolume);

      result.edges.push({
        from_id: sim.from_id,
        to_id: sim.to_id,
        from_username: usernameMap.get(sim.from_id),
        to_username: usernameMap.get(sim.to_id),
        weight: sim.similarity,
        confidence,
        metric: sim.metric,
        source: 'CO_ENGAGEMENT',
        created_at: new Date(),
      });

      edgeCounts.set(sim.from_id, fromCount + 1);
      edgeCounts.set(sim.to_id, toCount + 1);
    }

    // Calculate stats
    const connectedNodes = new Set<string>();
    for (const e of result.edges) {
      connectedNodes.add(e.from_id);
      connectedNodes.add(e.to_id);
    }

    result.stats.nodes_count = connectedNodes.size;
    result.stats.edges_count = result.edges.length;
    result.stats.avg_similarity = result.edges.length > 0
      ? result.edges.reduce((s, e) => s + e.weight, 0) / result.edges.length
      : 0;
    result.stats.avg_confidence = result.edges.length > 0
      ? result.edges.reduce((s, e) => s + e.confidence, 0) / result.edges.length
      : 0;

    result.success = true;
    console.log(`[CoEngagementGraph] Built ${result.edges.length} edges connecting ${result.stats.nodes_count} nodes`);
  } catch (err: any) {
    result.warnings.push(`Build failed: ${err.message}`);
    console.error('[CoEngagementGraph] Error:', err.message);
  }

  return result;
}
