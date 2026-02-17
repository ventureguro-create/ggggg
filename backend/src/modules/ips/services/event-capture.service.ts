/**
 * Event Capture Service
 * 
 * PHASE G1: Captures Twitter events and extracts asset references
 * Read-only, no interpretation, just facts
 */

import { IPSEvent, EventType } from '../models/ips.types';

// Asset extraction patterns
const ASSET_PATTERNS = [
  // Tickers with $
  /\$([A-Z]{2,10})\b/gi,
  // Common assets
  /\b(BTC|ETH|SOL|ARB|OP|MATIC|AVAX|LINK|UNI|AAVE|CRV|MKR|SNX|COMP|YFI|SUSHI|1INCH|DYDX|GMX|PEPE|SHIB|DOGE|APE|BLUR|LOOKS|X2Y2|LDO|RPL|FXS|CVX|BAL|LQTY)\b/gi
];

// Project patterns
const PROJECT_PATTERNS = [
  /\b(Uniswap|Aave|Compound|Curve|MakerDAO|dYdX|GMX|Blur|OpenSea|Lido|RocketPool|Frax|Convex|Balancer|Liquity)\b/gi
];

/**
 * Extract asset ticker from tweet text
 */
export function extractAsset(text: string): string | undefined {
  for (const pattern of ASSET_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.length > 0) {
      // Clean up and uppercase
      return match[0].replace('$', '').toUpperCase();
    }
  }
  return undefined;
}

/**
 * Extract project reference from tweet text
 */
export function extractProject(text: string): string | undefined {
  for (const pattern of PROJECT_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.length > 0) {
      return match[0];
    }
  }
  return undefined;
}

/**
 * Determine event type
 */
export function determineEventType(tweet: any): EventType {
  if (tweet.referenced_tweets) {
    const refType = tweet.referenced_tweets[0]?.type;
    if (refType === 'replied_to') return 'reply';
    if (refType === 'quoted') return 'quote';
  }
  if (tweet.conversation_id && tweet.conversation_id !== tweet.id) {
    return 'thread';
  }
  return 'tweet';
}

/**
 * Main capture function: Tweet → IPSEvent
 * Returns null if no asset detected (we don't track noise)
 */
export function captureEvent(tweet: {
  id: string;
  author_id?: string;
  authorId?: string;
  text: string;
  created_at?: string;
  createdAt?: number;
  type?: string;
  referenced_tweets?: any[];
  public_metrics?: {
    impression_count?: number;
    retweet_count?: number;
    like_count?: number;
  };
}): IPSEvent | null {
  const text = tweet.text || '';
  const asset = extractAsset(text);
  
  // No asset = no IPS event (we only track asset-related activity)
  if (!asset) return null;
  
  const projectId = extractProject(text);
  const actorId = tweet.author_id || tweet.authorId || '';
  
  if (!actorId) return null;
  
  // Calculate reach estimate
  const metrics = tweet.public_metrics;
  const reach = metrics 
    ? (metrics.impression_count || 0) + 
      (metrics.retweet_count || 0) * 100 + 
      (metrics.like_count || 0) * 10
    : 0;
  
  return {
    id: tweet.id,
    actorId,
    source: 'twitter',
    eventType: determineEventType(tweet),
    asset,
    projectId,
    timestamp: tweet.createdAt || (tweet.created_at ? new Date(tweet.created_at).getTime() : Date.now()),
    contentHash: simpleHash(text),
    reach
  };
}

/**
 * Simple hash for content dedup
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Batch capture from multiple tweets
 */
export function captureEvents(tweets: any[]): IPSEvent[] {
  return tweets
    .map(captureEvent)
    .filter((e): e is IPSEvent => e !== null);
}
