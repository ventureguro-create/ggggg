/**
 * Twitter Live Diff Service (Phase 4.2)
 * 
 * Compares Mock vs Live data to validate formulas.
 * NO WRITES. NO ALERTS. READ-ONLY ANALYSIS.
 */

import type { TwitterAuthorSnapshot, TwitterEngagementEvent, TwitterFollowEdge } from '../adapters/twitter/contracts/index.js';
import { computeTwitterConfidence } from '../twitter-confidence/index.js';

/**
 * Diff result for single account
 */
export interface AccountDiffResult {
  author_id: string;
  username: string;
  
  // Score comparison
  scores: {
    mock: {
      twitter_score: number;
      audience_quality: number;
      authority: number;
      smart_followers: number;
    };
    live: {
      twitter_score: number;
      audience_quality: number;
      authority: number;
      smart_followers: number;
    };
    delta: {
      twitter_score: number;
      audience_quality: number;
      authority: number;
      smart_followers: number;
    };
    delta_pct: {
      twitter_score: number;
      audience_quality: number;
      authority: number;
      smart_followers: number;
    };
  };
  
  // Confidence
  confidence: {
    mock: number;
    live: number;
  };
  
  // Flags
  flags: string[];
  
  // Explain
  explain: string[];
}

/**
 * Batch diff result
 */
export interface BatchDiffResult {
  success: boolean;
  mode: 'mock' | 'live_preview';
  
  // Counts
  accounts_compared: number;
  accounts_with_diff: number;
  
  // Summary stats
  avg_score_delta: number;
  avg_confidence_delta: number;
  
  // Individual results
  accounts: AccountDiffResult[];
  
  // Aggregate flags
  aggregate_flags: {
    flag: string;
    count: number;
  }[];
  
  // Warnings
  warnings: string[];
}

/**
 * Compute scores from live data
 */
function computeLiveScores(
  author: TwitterAuthorSnapshot,
  engagements: TwitterEngagementEvent[],
  edges: TwitterFollowEdge[]
): {
  twitter_score: number;
  audience_quality: number;
  authority: number;
  smart_followers: number;
} {
  // Base score from followers (simplified for Phase 4.2)
  const followerScore = Math.min(author.followers / 100000, 1) * 300;
  
  // Engagement quality
  const avgEngagement = engagements.length > 0
    ? engagements.reduce((sum, e) => sum + e.likes + e.reposts + e.replies, 0) / engagements.length
    : 0;
  const engagementScore = Math.min(avgEngagement / 1000, 1) * 200;
  
  // Network score from edges
  const edgeCount = edges.filter(e => e.from_id === author.author_id || e.to_id === author.author_id).length;
  const networkScore = Math.min(edgeCount / 100, 1) * 300;
  
  // Consistency bonus
  const consistency = engagements.length > 5 ? 100 : engagements.length * 20;
  
  const twitter_score = Math.round(followerScore + engagementScore + networkScore + consistency);
  
  // Audience quality (0-1)
  const audience_quality = Math.min(
    0.3 + (engagementScore / 200) * 0.4 + (networkScore / 300) * 0.3,
    1
  );
  
  // Authority (0-1)
  const authority = Math.min(
    0.2 + (followerScore / 300) * 0.5 + (networkScore / 300) * 0.3,
    1
  );
  
  // Smart followers estimate
  const smart_followers = Math.round(authority * 100 * (engagements.length > 0 ? 1 : 0.5));
  
  return {
    twitter_score: Math.min(twitter_score, 1000),
    audience_quality: Math.round(audience_quality * 100) / 100,
    authority: Math.round(authority * 100) / 100,
    smart_followers: Math.min(smart_followers, 100),
  };
}

/**
 * Generate mock scores (deterministic based on author_id)
 */
function generateMockScores(authorId: string): {
  twitter_score: number;
  audience_quality: number;
  authority: number;
  smart_followers: number;
} {
  // Deterministic pseudo-random based on author_id
  const hash = authorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = (hash % 1000) / 1000;
  
  return {
    twitter_score: Math.round(400 + seed * 400),
    audience_quality: Math.round((0.5 + seed * 0.4) * 100) / 100,
    authority: Math.round((0.4 + seed * 0.4) * 100) / 100,
    smart_followers: Math.round(40 + seed * 40),
  };
}

/**
 * Compute diff for single account
 */
export function computeAccountDiff(
  author: TwitterAuthorSnapshot,
  engagements: TwitterEngagementEvent[],
  edges: TwitterFollowEdge[]
): AccountDiffResult {
  const mockScores = generateMockScores(author.author_id);
  const liveScores = computeLiveScores(author, engagements, edges);
  
  const delta = {
    twitter_score: liveScores.twitter_score - mockScores.twitter_score,
    audience_quality: liveScores.audience_quality - mockScores.audience_quality,
    authority: liveScores.authority - mockScores.authority,
    smart_followers: liveScores.smart_followers - mockScores.smart_followers,
  };
  
  const delta_pct = {
    twitter_score: mockScores.twitter_score > 0 ? (delta.twitter_score / mockScores.twitter_score) * 100 : 0,
    audience_quality: mockScores.audience_quality > 0 ? (delta.audience_quality / mockScores.audience_quality) * 100 : 0,
    authority: mockScores.authority > 0 ? (delta.authority / mockScores.authority) * 100 : 0,
    smart_followers: mockScores.smart_followers > 0 ? (delta.smart_followers / mockScores.smart_followers) * 100 : 0,
  };
  
  // Compute confidence
  const dataAgeHours = (Date.now() - author.collected_at.getTime()) / (1000 * 60 * 60);
  const liveConfidence = computeTwitterConfidence({
    author_id: author.author_id,
    data_age_hours: dataAgeHours,
    has_profile_meta: true,
    has_engagement: engagements.length > 0,
    has_follow_graph: edges.length > 0,
    anomaly_flags: {},
    source_type: 'parser_storage',
  });
  
  // Generate flags
  const flags: string[] = [];
  if (Math.abs(delta_pct.twitter_score) > 20) flags.push('SCORE_SIGNIFICANT_DIFF');
  if (delta.twitter_score > 100) flags.push('LIVE_SCORE_HIGHER');
  if (delta.twitter_score < -100) flags.push('LIVE_SCORE_LOWER');
  if (engagements.length === 0) flags.push('NO_ENGAGEMENT_DATA');
  if (edges.length === 0) flags.push('NO_GRAPH_DATA');
  if (edges.length > 50) flags.push('RICH_GRAPH');
  if (liveConfidence.score_0_1 < 0.5) flags.push('LOW_CONFIDENCE');
  
  // Generate explain
  const explain: string[] = [];
  if (delta.twitter_score > 50) {
    explain.push(`Live data shows ${delta.twitter_score} points higher score`);
  } else if (delta.twitter_score < -50) {
    explain.push(`Live data shows ${Math.abs(delta.twitter_score)} points lower score`);
  }
  if (engagements.length > 10) {
    explain.push(`${engagements.length} engagement events provide richer signal`);
  }
  if (edges.length > 20) {
    explain.push(`Network graph with ${edges.length} edges improves authority estimate`);
  }
  if (explain.length === 0) {
    explain.push('Mock and live scores are similar');
  }
  
  return {
    author_id: author.author_id,
    username: author.username,
    scores: {
      mock: mockScores,
      live: liveScores,
      delta,
      delta_pct,
    },
    confidence: {
      mock: 0.75, // Mock always has 75% confidence
      live: liveConfidence.score_0_1,
    },
    flags,
    explain,
  };
}

/**
 * Compute batch diff
 */
export function computeBatchDiff(
  authors: TwitterAuthorSnapshot[],
  engagements: TwitterEngagementEvent[],
  edges: TwitterFollowEdge[]
): BatchDiffResult {
  const accounts: AccountDiffResult[] = [];
  const warnings: string[] = [];
  
  // Group engagements and edges by author
  const engagementsByAuthor = new Map<string, TwitterEngagementEvent[]>();
  const edgesByAuthor = new Map<string, TwitterFollowEdge[]>();
  
  for (const e of engagements) {
    if (!engagementsByAuthor.has(e.author_id)) {
      engagementsByAuthor.set(e.author_id, []);
    }
    engagementsByAuthor.get(e.author_id)!.push(e);
  }
  
  for (const edge of edges) {
    // Add to both from and to
    if (!edgesByAuthor.has(edge.from_id)) {
      edgesByAuthor.set(edge.from_id, []);
    }
    edgesByAuthor.get(edge.from_id)!.push(edge);
    
    if (!edgesByAuthor.has(edge.to_id)) {
      edgesByAuthor.set(edge.to_id, []);
    }
    edgesByAuthor.get(edge.to_id)!.push(edge);
  }
  
  // Compute diff for each author
  for (const author of authors) {
    const authorEngagements = engagementsByAuthor.get(author.author_id) || [];
    const authorEdges = edgesByAuthor.get(author.author_id) || [];
    
    const diff = computeAccountDiff(author, authorEngagements, authorEdges);
    accounts.push(diff);
  }
  
  // Compute aggregates
  const accountsWithDiff = accounts.filter(a => Math.abs(a.scores.delta.twitter_score) > 50).length;
  const avgScoreDelta = accounts.length > 0
    ? accounts.reduce((sum, a) => sum + a.scores.delta.twitter_score, 0) / accounts.length
    : 0;
  const avgConfidenceDelta = accounts.length > 0
    ? accounts.reduce((sum, a) => sum + (a.confidence.live - a.confidence.mock), 0) / accounts.length
    : 0;
  
  // Aggregate flags
  const flagCounts = new Map<string, number>();
  for (const account of accounts) {
    for (const flag of account.flags) {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    }
  }
  const aggregate_flags = Array.from(flagCounts.entries())
    .map(([flag, count]) => ({ flag, count }))
    .sort((a, b) => b.count - a.count);
  
  return {
    success: true,
    mode: 'live_preview',
    accounts_compared: accounts.length,
    accounts_with_diff: accountsWithDiff,
    avg_score_delta: Math.round(avgScoreDelta * 10) / 10,
    avg_confidence_delta: Math.round(avgConfidenceDelta * 100) / 100,
    accounts,
    aggregate_flags,
    warnings,
  };
}
