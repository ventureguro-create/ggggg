/**
 * Twitter Adapter Service
 * 
 * Main service for reading Twitter data into Connections.
 * READ-ONLY: Never writes to Twitter collections.
 */

import { Db } from 'mongodb';
import { getAdapterConfig, getAdapterStatus, updateAdapterConfig, type AdapterMode } from './twitter-adapter.config.js';
import { readTwitterAuthors, type AuthorReadResult } from '../readers/twitterAuthor.reader.js';
import { readTwitterEngagements, type EngagementReadResult } from '../readers/twitterEngagement.reader.js';
import { readTwitterFollowEdges, getFollowGraphStatus, type FollowReadResult } from '../readers/twitterFollow.reader.js';
import { mapAuthorsToProfiles } from '../mappers/author.mapper.js';
import { mapEngagementsToConnections, aggregateByProfile } from '../mappers/engagement.mapper.js';

export interface AdapterReadAllResult {
  success: boolean;
  mode: AdapterMode;
  read_only: boolean;
  authors: AuthorReadResult;
  engagements: EngagementReadResult;
  follow_edges: FollowReadResult;
  coverage: {
    authors_count: number;
    engagements_count: number;
    edges_count: number;
    authors_pct: number;
    engagements_pct: number;
  };
  freshness: {
    authors_avg_hours: number;
    engagements_avg_hours: number;
  };
  confidence_hints: {
    cap: number;
    reason: string;
    graph_available: boolean;
  };
  warnings: string[];
}

/**
 * Read all Twitter data (READ-ONLY)
 */
export async function readAllTwitterData(db: Db): Promise<AdapterReadAllResult> {
  const config = getAdapterConfig();
  const status = getAdapterStatus();
  
  const result: AdapterReadAllResult = {
    success: false,
    mode: config.mode,
    read_only: true,
    authors: { success: false, authors: [], total_count: 0, coverage: { with_id: 0, with_followers: 0, with_verified: 0 }, freshness: { avg_age_hours: 0 }, warnings: [] },
    engagements: { success: false, events: [], total_count: 0, stats: { total_likes: 0, total_reposts: 0, total_replies: 0, total_views: 0, avg_engagement_rate: 0 }, freshness: { avg_age_hours: 0 }, warnings: [] },
    follow_edges: { success: true, status: 'DISABLED', reason: '', edges: [], total_count: 0, warnings: [] },
    coverage: { authors_count: 0, engagements_count: 0, edges_count: 0, authors_pct: 0, engagements_pct: 0 },
    freshness: { authors_avg_hours: 0, engagements_avg_hours: 0 },
    confidence_hints: { cap: config.confidence_cap, reason: 'Graph disabled - confidence capped', graph_available: false },
    warnings: [],
  };

  if (!config.enabled || config.mode === 'off') {
    result.warnings.push('Adapter disabled');
    return result;
  }

  try {
    // Read authors
    if (config.sources.followers) {
      result.authors = await readTwitterAuthors(db, { limit: config.batch_size, max_age_hours: config.safety.max_data_age_hours.author });
      result.coverage.authors_count = result.authors.total_count;
      result.freshness.authors_avg_hours = result.authors.freshness.avg_age_hours;
    }

    // Read engagements
    if (config.sources.engagements) {
      const authorIds = result.authors.authors.map(a => a.author_id);
      result.engagements = await readTwitterEngagements(db, { author_ids: authorIds.length > 0 ? authorIds : undefined, limit: 1000, max_age_hours: config.safety.max_data_age_hours.engagement });
      result.coverage.engagements_count = result.engagements.total_count;
      result.freshness.engagements_avg_hours = result.engagements.freshness.avg_age_hours;
    }

    // Follow edges - always disabled
    result.follow_edges = await readTwitterFollowEdges(db);
    result.coverage.edges_count = 0;

    // Calculate coverage percentages
    const totalAuthorsExpected = 100;
    result.coverage.authors_pct = Math.min(100, (result.coverage.authors_count / totalAuthorsExpected) * 100);
    result.coverage.engagements_pct = result.coverage.authors_count > 0 ? Math.min(100, (result.coverage.engagements_count / (result.coverage.authors_count * 10)) * 100) : 0;

    // Confidence hints
    const graphStatus = getFollowGraphStatus();
    result.confidence_hints = {
      cap: graphStatus.confidence_cap,
      reason: graphStatus.reason,
      graph_available: graphStatus.available,
    };

    result.success = true;
    console.log(`[TwitterAdapter] Read complete: ${result.coverage.authors_count} authors, ${result.coverage.engagements_count} engagements`);
  } catch (err: any) {
    result.warnings.push(`Read failed: ${err.message}`);
    console.error('[TwitterAdapter] Error:', err.message);
  }

  return result;
}

/**
 * Get mapped profiles for Connections
 */
export async function getMappedProfiles(db: Db) {
  const data = await readAllTwitterData(db);
  if (!data.success) return { profiles: [], aggregated: new Map() };
  
  const profiles = mapAuthorsToProfiles(data.authors.authors);
  const aggregated = aggregateByProfile(data.engagements.events);
  
  return { profiles, aggregated };
}

/**
 * Compare mock vs live data (dry diff)
 */
export async function getDryDiff(db: Db, mockData: { authors: number; engagements: number }) {
  const liveData = await readAllTwitterData(db);
  
  return {
    mock: mockData,
    live: { authors: liveData.coverage.authors_count, engagements: liveData.coverage.engagements_count },
    delta: {
      authors: liveData.coverage.authors_count - mockData.authors,
      engagements: liveData.coverage.engagements_count - mockData.engagements,
    },
    status: liveData.coverage.authors_count === 0 ? 'NO_DATA' : liveData.coverage.authors_count < mockData.authors ? 'PARTIAL' : 'OK',
  };
}

/**
 * Set adapter mode
 */
export function setAdapterMode(mode: AdapterMode) {
  return updateAdapterConfig({ mode, enabled: mode !== 'off' });
}

/**
 * Enable/disable adapter
 */
export function setAdapterEnabled(enabled: boolean) {
  return updateAdapterConfig({ enabled, mode: enabled ? 'dry-run' : 'off' });
}

export { getAdapterConfig, getAdapterStatus, updateAdapterConfig };

// Legacy functions for existing routes compatibility
export async function processAuthors(authors: any[]) {
  return { processed: authors.length, mode: 'dry-run', would_write: authors.length };
}

export async function processEngagements(engagements: any[]) {
  return { processed: engagements.length, mode: 'dry-run', would_write: engagements.length };
}

export async function processFollowEdges(edges: any[]) {
  return { processed: 0, mode: 'dry-run', would_write: 0, reason: 'Graph disabled' };
}

export async function runDryRunDiff(authorId: string, _twitterData: any) {
  return {
    author_id: authorId,
    mock_score: 0.6,
    twitter_score: null,
    delta: 0,
    status: 'NO_DATA',
    reason: 'Twitter data not available for comparison',
  };
}
