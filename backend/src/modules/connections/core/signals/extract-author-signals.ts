/**
 * Extract Author Signals from TwitterPost
 * 
 * ONLY uses allowed fields from TwitterPost v1.0.0 contract:
 * - author_id, author_handle
 * - likes, reposts, replies, views
 * - created_at
 * 
 * Optional: engaged_user_ids for overlap calculations
 * (not part of contract, passed separately by parser)
 */

export interface AuthorSignals {
  author_id: string;
  handle: string;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    views: number | null;
  };
  audience: {
    window_days: number;
    engaged_user_ids: string[];
  };
  timestamp: string;
}

export function extractAuthorSignals(post: any): AuthorSignals | null {
  // Support multiple formats
  const authorId = post.author?.author_id || post.author_id;
  const handle = post.author?.username || post.author_handle || post.author_username || 'unknown';

  if (!authorId) return null;

  // Extract engagement from post (support nested and flat formats)
  const engagement = post.engagement || {};
  
  // Optional: engaged user IDs for overlap (not in contract, passed separately)
  const engagedIds = Array.isArray(post.engaged_user_ids) 
    ? post.engaged_user_ids 
    : [];
  
  return {
    author_id: authorId,
    handle,
    metrics: {
      likes: engagement.likes ?? post.likes ?? 0,
      reposts: engagement.reposts ?? post.reposts ?? 0,
      replies: engagement.replies ?? post.replies ?? 0,
      views: engagement.views ?? post.views ?? null,
    },
    audience: {
      window_days: 30,
      engaged_user_ids: engagedIds,
    },
    timestamp: post.created_at || new Date().toISOString(),
  };
}
