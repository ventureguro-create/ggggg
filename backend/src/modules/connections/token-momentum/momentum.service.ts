/**
 * Token Momentum Scoring
 * 
 * Calculates momentum scores for tokens based on influencer mentions
 * Tracks velocity, acceleration, and smart money signals
 */
import { getMongoDb } from '../../../db/mongoose.js';

const UNIFIED_ACCOUNTS = 'connections_unified_accounts';
const TOKEN_MOMENTUM = 'connections_token_momentum';
const TOKEN_MENTIONS = 'connections_token_mentions';

export interface TokenMomentum {
  token: string;
  symbol: string;
  currentScore: number;
  velocity: number;          // Rate of change
  acceleration: number;      // Rate of velocity change
  smartMoneyScore: number;   // Weighted by smart influencers
  earlySignalScore: number;  // Weighted by early callers
  mentionCount24h: number;
  mentionCount7d: number;
  uniqueInfluencers24h: number;
  topMentioners: {
    handle: string;
    influence: number;
    smart: number;
    early: number;
    mentionTime: Date;
  }[];
  trend: 'surging' | 'rising' | 'stable' | 'declining' | 'crashing';
  updatedAt: Date;
}

/**
 * Calculate momentum score for a single token
 */
export function calculateMomentumScore(mentions: any[]): {
  velocity: number;
  acceleration: number;
  smartMoneyScore: number;
  earlySignalScore: number;
  totalScore: number;
} {
  if (!mentions.length) {
    return { velocity: 0, acceleration: 0, smartMoneyScore: 0, earlySignalScore: 0, totalScore: 0 };
  }
  
  // Sort by time
  const sorted = [...mentions].sort((a, b) => 
    new Date(a.mentionTime).getTime() - new Date(b.mentionTime).getTime()
  );
  
  const now = Date.now();
  const hour = 3600 * 1000;
  const day = 24 * hour;
  
  // Count mentions in time buckets
  const last1h = mentions.filter(m => now - new Date(m.mentionTime).getTime() < hour).length;
  const last6h = mentions.filter(m => now - new Date(m.mentionTime).getTime() < 6 * hour).length;
  const last24h = mentions.filter(m => now - new Date(m.mentionTime).getTime() < day).length;
  const last48h = mentions.filter(m => now - new Date(m.mentionTime).getTime() < 2 * day).length;
  
  // Velocity: Recent activity normalized
  const velocity = Math.min(
    ((last1h * 24) + (last6h * 4) + last24h) / 3 / Math.max(mentions.length, 1),
    1
  );
  
  // Acceleration: Change in velocity (comparing 24h periods)
  const prev24hRate = (last48h - last24h) / Math.max(last48h, 1);
  const curr24hRate = last24h / Math.max(last48h, 1);
  const acceleration = Math.max(-1, Math.min(1, curr24hRate - prev24hRate));
  
  // Smart money score: Weighted by influencer smartness
  let smartWeightSum = 0;
  let smartTotalWeight = 0;
  for (const m of mentions) {
    const smartness = m.influencer?.smart || 0.5;
    const influence = m.influencer?.influence || 0.5;
    const weight = (smartness * 0.6 + influence * 0.4);
    // Recency bonus
    const recencyBonus = Math.max(0, 1 - (now - new Date(m.mentionTime).getTime()) / (7 * day));
    smartWeightSum += weight * recencyBonus;
    smartTotalWeight += recencyBonus;
  }
  const smartMoneyScore = smartTotalWeight > 0 ? smartWeightSum / smartTotalWeight : 0;
  
  // Early signal score: Weighted by early caller reputation
  let earlyWeightSum = 0;
  let earlyTotalWeight = 0;
  for (const m of mentions) {
    const early = m.influencer?.early || 0.5;
    const influence = m.influencer?.influence || 0.5;
    const weight = (early * 0.7 + influence * 0.3);
    const recencyBonus = Math.max(0, 1 - (now - new Date(m.mentionTime).getTime()) / (7 * day));
    earlyWeightSum += weight * recencyBonus;
    earlyTotalWeight += recencyBonus;
  }
  const earlySignalScore = earlyTotalWeight > 0 ? earlyWeightSum / earlyTotalWeight : 0;
  
  // Total score combining all factors
  const totalScore = (
    velocity * 0.25 +
    Math.max(0, acceleration) * 0.15 +
    smartMoneyScore * 0.35 +
    earlySignalScore * 0.25
  );
  
  return {
    velocity: Math.round(velocity * 1000) / 1000,
    acceleration: Math.round(acceleration * 1000) / 1000,
    smartMoneyScore: Math.round(smartMoneyScore * 1000) / 1000,
    earlySignalScore: Math.round(earlySignalScore * 1000) / 1000,
    totalScore: Math.round(totalScore * 1000) / 1000,
  };
}

/**
 * Determine trend from velocity and acceleration
 */
export function determineTrend(velocity: number, acceleration: number): TokenMomentum['trend'] {
  if (velocity > 0.7 && acceleration > 0.3) return 'surging';
  if (velocity > 0.4 || acceleration > 0.2) return 'rising';
  if (velocity < 0.1 && acceleration < -0.3) return 'crashing';
  if (acceleration < -0.1) return 'declining';
  return 'stable';
}

/**
 * Extract token mentions from influencer tweets
 * Returns ticker symbols like $BTC, $ETH, etc.
 */
export function extractTokenMentions(text: string): string[] {
  if (!text) return [];
  
  // Match $SYMBOL pattern (1-10 uppercase letters after $)
  const matches = text.match(/\$[A-Z]{1,10}\b/g) || [];
  
  // Filter common false positives
  const blacklist = ['$USD', '$EUR', '$GBP', '$JPY', '$CAD', '$AUD'];
  
  return [...new Set(matches.filter(t => !blacklist.includes(t)))];
}

/**
 * Process new tweets and update token momentum
 */
export async function updateTokenMomentum(tweets: any[]): Promise<{ tokens: string[]; updated: number }> {
  const db = getMongoDb();
  const tokensUpdated = new Set<string>();
  
  // Get all unified accounts for enriching
  const accounts = await db.collection(UNIFIED_ACCOUNTS).find({}).toArray();
  const accountsByHandle = new Map<string, any>();
  for (const acc of accounts) {
    const handle = acc.handle?.toLowerCase();
    if (handle) accountsByHandle.set(handle, acc);
  }
  
  // Process each tweet
  for (const tweet of tweets) {
    const text = tweet.text || tweet.full_text || '';
    const tokens = extractTokenMentions(text);
    
    if (tokens.length === 0) continue;
    
    // Get influencer data
    const authorHandle = tweet.author?.username?.toLowerCase() || tweet.user?.screen_name?.toLowerCase();
    const influencer = accountsByHandle.get(authorHandle) || {
      influence: 0.5,
      smart: 0.5,
      early: 0.5,
    };
    
    // Save mention for each token
    const mentionsCol = db.collection(TOKEN_MENTIONS);
    for (const token of tokens) {
      await mentionsCol.insertOne({
        token,
        tweetId: tweet.id || tweet.id_str,
        authorHandle,
        authorId: tweet.author?.id || tweet.user?.id_str,
        text: text.substring(0, 280),
        mentionTime: new Date(tweet.created_at || Date.now()),
        influencer: {
          influence: influencer.influence || 0.5,
          smart: influencer.smart || 0.5,
          early: influencer.early || 0.5,
          followers: influencer.followers || 0,
        },
        createdAt: new Date(),
      });
      
      tokensUpdated.add(token);
    }
  }
  
  // Recalculate momentum for each updated token
  const momentumCol = db.collection(TOKEN_MOMENTUM);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  for (const token of tokensUpdated) {
    // Get mentions for this token in last 7 days
    const mentions = await db.collection(TOKEN_MENTIONS)
      .find({ 
        token,
        mentionTime: { $gte: sevenDaysAgo }
      })
      .toArray();
    
    const scores = calculateMomentumScore(mentions);
    const trend = determineTrend(scores.velocity, scores.acceleration);
    
    // Count unique influencers
    const uniqueHandles24h = new Set(
      mentions
        .filter(m => new Date(m.mentionTime) >= oneDayAgo)
        .map(m => m.authorHandle)
    );
    
    // Get top mentioners
    const topMentioners = mentions
      .sort((a, b) => (b.influencer?.influence || 0) - (a.influencer?.influence || 0))
      .slice(0, 5)
      .map(m => ({
        handle: m.authorHandle,
        influence: m.influencer?.influence || 0,
        smart: m.influencer?.smart || 0,
        early: m.influencer?.early || 0,
        mentionTime: m.mentionTime,
      }));
    
    // Update momentum record
    await momentumCol.updateOne(
      { token },
      {
        $set: {
          token,
          symbol: token.replace('$', ''),
          currentScore: scores.totalScore,
          velocity: scores.velocity,
          acceleration: scores.acceleration,
          smartMoneyScore: scores.smartMoneyScore,
          earlySignalScore: scores.earlySignalScore,
          mentionCount24h: mentions.filter(m => new Date(m.mentionTime) >= oneDayAgo).length,
          mentionCount7d: mentions.length,
          uniqueInfluencers24h: uniqueHandles24h.size,
          topMentioners,
          trend,
          updatedAt: now,
        }
      },
      { upsert: true }
    );
  }
  
  return { 
    tokens: [...tokensUpdated], 
    updated: tokensUpdated.size 
  };
}

/**
 * Get top momentum tokens
 */
export async function getTopMomentumTokens(limit: number = 20): Promise<TokenMomentum[]> {
  const db = getMongoDb();
  
  const tokens = await db.collection(TOKEN_MOMENTUM)
    .find({})
    .sort({ currentScore: -1 })
    .limit(limit)
    .toArray();
  
  return tokens.map(t => ({
    token: t.token,
    symbol: t.symbol,
    currentScore: t.currentScore,
    velocity: t.velocity,
    acceleration: t.acceleration,
    smartMoneyScore: t.smartMoneyScore,
    earlySignalScore: t.earlySignalScore,
    mentionCount24h: t.mentionCount24h,
    mentionCount7d: t.mentionCount7d,
    uniqueInfluencers24h: t.uniqueInfluencers24h,
    topMentioners: t.topMentioners || [],
    trend: t.trend,
    updatedAt: t.updatedAt,
  }));
}

/**
 * Get momentum for specific token
 */
export async function getTokenMomentum(symbol: string): Promise<TokenMomentum | null> {
  const db = getMongoDb();
  const token = symbol.startsWith('$') ? symbol : `$${symbol.toUpperCase()}`;
  
  const momentum = await db.collection(TOKEN_MOMENTUM).findOne({ token });
  
  if (!momentum) return null;
  
  return {
    token: momentum.token,
    symbol: momentum.symbol,
    currentScore: momentum.currentScore,
    velocity: momentum.velocity,
    acceleration: momentum.acceleration,
    smartMoneyScore: momentum.smartMoneyScore,
    earlySignalScore: momentum.earlySignalScore,
    mentionCount24h: momentum.mentionCount24h,
    mentionCount7d: momentum.mentionCount7d,
    uniqueInfluencers24h: momentum.uniqueInfluencers24h,
    topMentioners: momentum.topMentioners || [],
    trend: momentum.trend,
    updatedAt: momentum.updatedAt,
  };
}

/**
 * Get trending tokens (surging or rising)
 */
export async function getTrendingTokens(limit: number = 10): Promise<TokenMomentum[]> {
  const db = getMongoDb();
  
  const tokens = await db.collection(TOKEN_MOMENTUM)
    .find({ trend: { $in: ['surging', 'rising'] } })
    .sort({ velocity: -1, currentScore: -1 })
    .limit(limit)
    .toArray();
  
  return tokens as TokenMomentum[];
}
