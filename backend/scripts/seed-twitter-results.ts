/**
 * Seed twitter_results - Pilot Live Feed
 * 
 * Creates test data identical to production structure.
 * 5 patterns: normal, flat, breakout, bot-like, smart-no-name
 * 
 * Usage: npx tsx scripts/seed-twitter-results.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/connections_db';
const COLLECTION = 'twitter_results';

// Author patterns
const AUTHORS = [
  // Pattern 1: Normal Growth (3 authors)
  { id: 'ng_001', username: 'crypto_analyst', name: 'Crypto Analyst Pro', verified: true, followers: 45000, pattern: 'normal' },
  { id: 'ng_002', username: 'defi_insider', name: 'DeFi Insider', verified: false, followers: 28000, pattern: 'normal' },
  { id: 'ng_003', username: 'web3_builder', name: 'Web3 Builder', verified: true, followers: 67000, pattern: 'normal' },
  
  // Pattern 2: Flat (2 authors)
  { id: 'fl_001', username: 'quiet_trader', name: 'Quiet Trader', verified: false, followers: 12000, pattern: 'flat' },
  { id: 'fl_002', username: 'market_watcher', name: 'Market Watcher', verified: false, followers: 8500, pattern: 'flat' },
  
  // Pattern 3: Breakout Spike (2 authors)
  { id: 'br_001', username: 'alpha_hunter', name: 'Alpha Hunter', verified: true, followers: 89000, pattern: 'breakout' },
  { id: 'br_002', username: 'trend_spotter', name: 'Trend Spotter', verified: false, followers: 34000, pattern: 'breakout' },
  
  // Pattern 4: Bot / Like Farm (2 authors)
  { id: 'bt_001', username: 'mega_crypto_news', name: 'MEGA CRYPTO NEWS', verified: false, followers: 250000, pattern: 'bot' },
  { id: 'bt_002', username: 'daily_gains_xyz', name: 'Daily Gains XYZ', verified: false, followers: 180000, pattern: 'bot' },
  
  // Pattern 5: Smart No-name (3 authors) - KEY FOR CONNECTIONS
  { id: 'sn_001', username: 'quiet_genius', name: 'Quiet Genius', verified: false, followers: 850, pattern: 'smart' },
  { id: 'sn_002', username: 'underground_alpha', name: 'Underground Alpha', verified: false, followers: 1200, pattern: 'smart' },
  { id: 'sn_003', username: 'stealth_whale', name: 'Stealth Whale', verified: false, followers: 620, pattern: 'smart' },
];

// Generate engagement based on pattern
function generateEngagement(pattern: string, baseFollowers: number, isSpike: boolean = false) {
  switch (pattern) {
    case 'normal':
      // Healthy engagement: 2-5% of followers
      const normalBase = Math.floor(baseFollowers * (0.02 + Math.random() * 0.03));
      return {
        likes: normalBase + Math.floor(Math.random() * 100),
        reposts: Math.floor(normalBase * 0.3) + Math.floor(Math.random() * 20),
        replies: Math.floor(normalBase * 0.15) + Math.floor(Math.random() * 10),
        views: normalBase * (15 + Math.floor(Math.random() * 10)),
      };
    
    case 'flat':
      // Almost no engagement
      return {
        likes: Math.floor(Math.random() * 15),
        reposts: Math.floor(Math.random() * 3),
        replies: Math.floor(Math.random() * 2),
        views: 100 + Math.floor(Math.random() * 500),
      };
    
    case 'breakout':
      if (isSpike) {
        // Viral spike: 10-20x normal
        return {
          likes: 5000 + Math.floor(Math.random() * 15000),
          reposts: 1500 + Math.floor(Math.random() * 5000),
          replies: 800 + Math.floor(Math.random() * 2000),
          views: 500000 + Math.floor(Math.random() * 1500000),
        };
      }
      // Normal tweets for breakout author
      return {
        likes: 200 + Math.floor(Math.random() * 300),
        reposts: 50 + Math.floor(Math.random() * 100),
        replies: 30 + Math.floor(Math.random() * 50),
        views: 10000 + Math.floor(Math.random() * 20000),
      };
    
    case 'bot':
      // Suspicious: high likes, low reposts/replies, artificial ratio
      const botLikes = 3000 + Math.floor(Math.random() * 7000);
      return {
        likes: botLikes,
        reposts: Math.floor(botLikes * 0.02), // Suspiciously low
        replies: Math.floor(botLikes * 0.01), // Almost none
        views: botLikes * 5, // Perfect ratio (suspicious)
      };
    
    case 'smart':
      // Low volume but high quality engagement
      return {
        likes: 50 + Math.floor(Math.random() * 150),
        reposts: 20 + Math.floor(Math.random() * 80), // High repost ratio
        replies: 15 + Math.floor(Math.random() * 40), // High reply ratio  
        views: 800 + Math.floor(Math.random() * 2000),
      };
    
    default:
      return { likes: 10, reposts: 2, replies: 1, views: 500 };
  }
}

// Generate tweet text based on pattern
function generateTweetText(pattern: string, index: number): string {
  const texts: Record<string, string[]> = {
    normal: [
      'Market analysis for today: key levels to watch $BTC $ETH',
      'Thread on DeFi protocols gaining traction this week',
      'Important update on the upcoming protocol changes',
      'My take on the current market structure',
      'Interesting development in the L2 space',
    ],
    flat: [
      'gm',
      'Another day in crypto',
      'Markets looking interesting',
      'Watching charts',
      'DYOR',
    ],
    breakout: [
      'BREAKING: Major announcement incoming',
      'This is the alpha you need right now - thread',
      'I called this 3 months ago, now everyone sees it',
      'The most important development of the year',
      'You are not prepared for what is coming',
    ],
    bot: [
      '🚀🚀🚀 HUGE GAINS INCOMING 🚀🚀🚀',
      '💰 FREE CRYPTO GIVEAWAY 💰 RT TO WIN',
      '📈 100X GEM ALERT 📈 NFA DYOR',
      '🔥 NEXT 1000X COIN REVEALED 🔥',
      '💎 DIAMOND HANDS ONLY 💎 WAGMI',
    ],
    smart: [
      'Noticed an interesting pattern in on-chain data that nobody is talking about',
      'Small observation: protocol X has been accumulating Y quietly',
      'Counter-intuitive take: the obvious trade is not the right trade here',
      'Worth noting: smart money moved before the announcement',
      'Connecting dots between seemingly unrelated events',
    ],
  };
  
  const pool = texts[pattern] || texts.normal;
  return pool[index % pool.length];
}

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Failed to connect to MongoDB');
  
  const collection = db.collection(COLLECTION);
  
  // Clear existing test data (optional - comment out to append)
  console.log('[Seed] Clearing existing test data...');
  await collection.deleteMany({ sessionId: { $regex: /^seed_/ } });
  
  const documents: any[] = [];
  const now = Date.now();
  const sessionId = `seed_${Date.now()}`;
  const taskId = `task_${Date.now()}`;
  
  console.log('[Seed] Generating documents...');
  
  for (const author of AUTHORS) {
    // Generate 25-50 tweets per author
    const tweetCount = 25 + Math.floor(Math.random() * 25);
    
    for (let i = 0; i < tweetCount; i++) {
      // Spread tweets over last 14 days
      const daysAgo = Math.random() * 14;
      const hoursAgo = Math.random() * 24;
      const tweetedAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000);
      const parsedAt = new Date(tweetedAt.getTime() + Math.random() * 60 * 60 * 1000);
      
      // For breakout pattern: make 2-3 tweets spikes
      const isSpike = author.pattern === 'breakout' && i < 3;
      const engagement = generateEngagement(author.pattern, author.followers, isSpike);
      
      documents.push({
        tweetId: `tw_${author.id}_${i}_${Date.now()}`,
        text: generateTweetText(author.pattern, i),
        username: author.username,
        displayName: author.name,
        
        author: {
          id: author.id,
          username: author.username,
          name: author.name,
          avatar: `https://pbs.twimg.com/profile_images/${author.id}/avatar.jpg`,
          verified: author.verified,
          followers: author.followers,
        },
        
        likes: engagement.likes,
        reposts: engagement.reposts,
        replies: engagement.replies,
        views: engagement.views,
        
        ownerType: 'SYSTEM',
        source: 'ACCOUNT',
        
        tweetedAt,
        parsedAt,
        createdAt: parsedAt,
        updatedAt: parsedAt,
        
        sessionId,
        taskId,
      });
    }
  }
  
  console.log(`[Seed] Inserting ${documents.length} documents...`);
  const result = await collection.insertMany(documents);
  
  console.log('[Seed] Complete!');
  console.log(`  - Authors: ${AUTHORS.length}`);
  console.log(`  - Tweets: ${result.insertedCount}`);
  console.log(`  - Session: ${sessionId}`);
  console.log(`  - Patterns: normal(3), flat(2), breakout(2), bot(2), smart(3)`);
  
  // Verify
  const stats = await collection.aggregate([
    { $match: { sessionId } },
    { $group: { _id: '$author.id', count: { $sum: 1 } } },
  ]).toArray();
  
  console.log('\n[Seed] Verification:');
  for (const s of stats) {
    const author = AUTHORS.find(a => a.id === s._id);
    console.log(`  - ${author?.username}: ${s.count} tweets (${author?.pattern})`);
  }
  
  await mongoose.disconnect();
  console.log('\n[Seed] Done.');
}

seed().catch(err => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
