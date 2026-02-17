/**
 * Author Mapper
 * 
 * Maps raw twitter author data to Connections Profile format.
 */

import type { AuthorSnapshot } from '../readers/twitterAuthor.reader.js';

export interface ConnectionsProfile {
  profile_id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  followers_count: number;
  is_verified: boolean;
  last_activity_at: Date;
  source: 'twitter' | 'mock';
  source_metadata: {
    tweet_count?: number;
    original_id?: string;
  };
}

/**
 * Map AuthorSnapshot to ConnectionsProfile
 */
export function mapAuthorToProfile(author: AuthorSnapshot): ConnectionsProfile {
  return {
    profile_id: author.author_id || author.username,
    username: normalizeUsername(author.username),
    display_name: author.display_name || author.username,
    avatar_url: author.avatar_url,
    followers_count: author.followers || 0,
    is_verified: author.verified || false,
    last_activity_at: author.last_seen_at || new Date(),
    source: 'twitter',
    source_metadata: {
      tweet_count: author.tweet_count,
      original_id: author.author_id,
    },
  };
}

/**
 * Map multiple authors to profiles
 */
export function mapAuthorsToProfiles(authors: AuthorSnapshot[]): ConnectionsProfile[] {
  return authors.map(mapAuthorToProfile);
}

/**
 * Normalize username (remove @ if present, lowercase)
 */
function normalizeUsername(username: string): string {
  if (!username) return 'unknown';
  return username.replace(/^@/, '').toLowerCase().trim();
}

/**
 * Get profile ID from author (fallback chain)
 */
export function getProfileId(author: Partial<AuthorSnapshot>): string {
  return author.author_id || author.username || `unknown_${Date.now()}`;
}
