/**
 * Map Twitter Author to Connections Profile
 * 
 * Converts TwitterAuthorSnapshot into Connections profile input.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 */

import type { TwitterAuthorSnapshot } from '../contracts/index.js';

/**
 * Connections profile input format
 */
export interface ConnectionsProfileInput {
  author_id: string;
  handle: string;
  display_name?: string;
  
  // Metrics
  followers_now: number;
  following_now: number;
  followers_following_ratio: number;
  
  // Profile
  verified: boolean;
  account_age_days: number;
  
  // Source
  source: 'twitter';
  source_collected_at: Date;
}

/**
 * Calculate account age in days
 */
function calculateAccountAgeDays(createdAt?: Date, referenceDate?: Date): number {
  if (!createdAt) return 0;
  const ref = referenceDate || new Date();
  const diffMs = ref.getTime() - createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Map Twitter author snapshot to Connections profile input
 */
export function mapAuthorToProfile(snapshot: TwitterAuthorSnapshot): ConnectionsProfileInput {
  const ratio = snapshot.following > 0 
    ? snapshot.followers / snapshot.following 
    : snapshot.followers > 0 ? 999 : 0;
  
  return {
    author_id: snapshot.author_id,
    handle: snapshot.username,
    display_name: snapshot.display_name,
    
    followers_now: snapshot.followers,
    following_now: snapshot.following,
    followers_following_ratio: Math.round(ratio * 100) / 100,
    
    verified: snapshot.verified,
    account_age_days: calculateAccountAgeDays(
      snapshot.account_created_at,
      snapshot.collected_at
    ),
    
    source: 'twitter',
    source_collected_at: snapshot.collected_at,
  };
}

/**
 * Map multiple authors
 */
export function mapAuthorsToProfiles(
  snapshots: TwitterAuthorSnapshot[]
): ConnectionsProfileInput[] {
  return snapshots.map(mapAuthorToProfile);
}
