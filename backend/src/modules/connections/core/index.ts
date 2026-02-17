/**
 * Connections Core - Main Entry Point
 * 
 * Processes TwitterPost data to build AuthorProfiles.
 * Called from aggregation layer.
 * 
 * Now uses MongoDB for persistence.
 */

import { extractAuthorSignals } from './signals/extract-author-signals.js';
import { normalizeAuthorMetrics } from './normalization/normalize-author-metrics.js';
import { computeInfluenceScore } from './scoring/compute-influence-score.js';
import { 
  upsertAuthorProfile, 
  mergeAudience, 
  getAuthorProfile 
} from '../storage/author-profile.store.js';
import { connectionsAdminConfig } from '../admin/connections-admin.js';

export async function processTwitterPostForConnections(twitterPost: any): Promise<void> {
  // Check if module is enabled
  if (!connectionsAdminConfig.enabled) return;

  // Step 1: Extract signals from post
  const signals = extractAuthorSignals(twitterPost);
  if (!signals) {
    console.log('[Connections] No author signals in post, skipping');
    return;
  }

  // Step 2: Normalize metrics
  const normalized = normalizeAuthorMetrics(signals);

  // Step 3: Get existing profile (for running averages)
  const existingProfile = await getAuthorProfile(signals.author_id);

  // Step 4: Compute scores
  const scored = computeInfluenceScore(normalized, existingProfile ?? undefined);

  // Step 5: Save profile to MongoDB (including engagement history for volatility)
  await upsertAuthorProfile(signals.author_id, {
    handle: scored.handle,
    followers: scored.followers,
    follower_growth_30d: scored.follower_growth_30d,
    activity: scored.activity,
    engagement: scored.engagement,
    network: scored.network,
    scores: scored.scores,
    _engagement_history: scored._engagement_history,
  } as any);

  // Step 6: Save engaged user IDs for overlap calculations
  if (signals.audience?.engaged_user_ids?.length > 0) {
    await mergeAudience(
      signals.author_id, 
      signals.handle, 
      signals.audience.engaged_user_ids, 
      signals.audience.window_days
    );
  }

  console.log(`[Connections] Processed ${signals.handle} → score: ${scored.scores.influence_score}`);
}

// Re-export types
export type { AuthorSignals } from './signals/extract-author-signals.js';
export type { NormalizedAuthorMetrics } from './normalization/normalize-author-metrics.js';
export type { AuthorProfile } from './scoring/compute-influence-score.js';
