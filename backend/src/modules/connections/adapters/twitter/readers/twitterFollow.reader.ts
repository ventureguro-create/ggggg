/**
 * Twitter Follow Reader
 * 
 * DISABLED - No follow graph data available from twitter_results.
 * Returns empty edges with status explanation.
 */

import { Db } from 'mongodb';

export interface FollowEdge {
  from_id: string;
  to_id: string;
  from_username?: string;
  to_username?: string;
  weight: number;
  discovered_at: Date;
}

export interface FollowReadResult {
  success: boolean;
  status: 'DISABLED' | 'NO_DATA' | 'PARTIAL' | 'OK';
  reason: string;
  edges: FollowEdge[];
  total_count: number;
  warnings: string[];
}

/**
 * Read follow edges - DISABLED
 * 
 * Twitter parser does not collect follow graph.
 * This reader returns empty data with explanation.
 */
export async function readTwitterFollowEdges(
  _db: Db,
  _options?: {
    author_ids?: string[];
    limit?: number;
  }
): Promise<FollowReadResult> {
  return {
    success: true,
    status: 'DISABLED',
    reason: 'Follow graph not available. Twitter parser collects tweets only, not follow relationships. Graph overlay uses MOCK data.',
    edges: [],
    total_count: 0,
    warnings: [
      'GRAPH_DISABLED: twitter_results does not contain follow edges',
      'CONFIDENCE_CAPPED: Graph-based confidence limited to 0.75 max',
    ],
  };
}

/**
 * Check if follow data is available
 */
export function isFollowGraphAvailable(): boolean {
  return false;
}

/**
 * Get follow graph status
 */
export function getFollowGraphStatus(): {
  available: boolean;
  source: string;
  reason: string;
  confidence_cap: number;
} {
  return {
    available: false,
    source: 'NONE',
    reason: 'Twitter parser does not collect follow relationships. Use separate follow graph parser to enable.',
    confidence_cap: 0.75,
  };
}
