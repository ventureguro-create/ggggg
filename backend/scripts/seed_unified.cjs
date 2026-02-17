/**
 * Seed script for connections_unified_accounts
 */
const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/connections_db';

// Sample unified accounts with correct structure
const unifiedAccounts = [
  // S-tier VCs & Founders
  {
    handle: 'vitalikbuterin',
    username: 'vitalikbuterin',
    kind: 'TWITTER',
    title: 'Vitalik Buterin',
    name: 'Vitalik Buterin',
    avatar: 'https://pbs.twimg.com/profile_images/1715123895313211392/eELkEvHc_400x400.jpg',
    categories: ['FOUNDER', 'DEVELOPER'],
    tags: ['ethereum', 'crypto', 'founder'],
    smart: 0.95,
    influence: 0.98,
    early: 0.85,
    authority: 0.99,
    handshake: 0.92,
    networkSize: 2500,
    followers: 5800000,
    following: 389,
    engagement: 0.0045,
    confidence: 0.95,
    verified: true,
    twitterScore: 98,
    networkScore: 95,
    engagementRate: 0.0045,
    source: 'seed'
  },
  {
    handle: 'cz_binance',
    username: 'cz_binance',
    kind: 'TWITTER',
    title: 'CZ Binance',
    name: 'CZ',
    avatar: 'https://pbs.twimg.com/profile_images/1477141849618501633/pHU5LHEU_400x400.jpg',
    categories: ['FOUNDER', 'EXCHANGE'],
    tags: ['binance', 'crypto', 'cex'],
    smart: 0.92,
    influence: 0.99,
    early: 0.78,
    authority: 0.98,
    handshake: 0.88,
    networkSize: 3200,
    followers: 9200000,
    following: 245,
    engagement: 0.0038,
    confidence: 0.92,
    verified: true,
    twitterScore: 96,
    networkScore: 97,
    engagementRate: 0.0038,
    source: 'seed'
  },
  {
    handle: 'a16z',
    username: 'a16z',
    kind: 'TWITTER',
    title: 'a16z',
    name: 'Andreessen Horowitz',
    avatar: 'https://pbs.twimg.com/profile_images/1347546830813261824/6YvHuVmA_400x400.png',
    categories: ['VC', 'INVESTOR'],
    tags: ['vc', 'investment', 'web3'],
    smart: 0.94,
    influence: 0.92,
    early: 0.88,
    authority: 0.96,
    handshake: 0.95,
    networkSize: 1800,
    followers: 1200000,
    following: 245,
    engagement: 0.0025,
    confidence: 0.94,
    verified: true,
    twitterScore: 94,
    networkScore: 92,
    engagementRate: 0.0025,
    source: 'seed'
  },
  {
    handle: 'paradigm',
    username: 'paradigm',
    kind: 'TWITTER',
    title: 'Paradigm',
    name: 'Paradigm',
    avatar: 'https://pbs.twimg.com/profile_images/1505231512556351490/dZn9-2Y5_400x400.jpg',
    categories: ['VC', 'INVESTOR'],
    tags: ['vc', 'defi', 'crypto'],
    smart: 0.93,
    influence: 0.88,
    early: 0.92,
    authority: 0.94,
    handshake: 0.91,
    networkSize: 1200,
    followers: 380000,
    following: 189,
    engagement: 0.0032,
    confidence: 0.93,
    verified: true,
    twitterScore: 92,
    networkScore: 88,
    engagementRate: 0.0032,
    source: 'seed'
  },
  // A-tier KOLs
  {
    handle: 'cobie',
    username: 'cobie',
    kind: 'TWITTER',
    title: 'Cobie',
    name: 'Cobie',
    avatar: 'https://pbs.twimg.com/profile_images/1517943016455655424/fGS9aZ-m_400x400.jpg',
    categories: ['KOL', 'TRADER'],
    tags: ['trading', 'alpha', 'defi'],
    smart: 0.88,
    influence: 0.85,
    early: 0.82,
    authority: 0.78,
    handshake: 0.75,
    networkSize: 950,
    followers: 920000,
    following: 456,
    engagement: 0.0055,
    confidence: 0.88,
    verified: true,
    twitterScore: 88,
    networkScore: 82,
    engagementRate: 0.0055,
    source: 'seed'
  },
  {
    handle: 'raoulpal',
    username: 'raoulpal',
    kind: 'TWITTER',
    title: 'Raoul Pal',
    name: 'Raoul Pal',
    avatar: 'https://pbs.twimg.com/profile_images/1609936912604258304/x-ioVpvU_400x400.jpg',
    categories: ['KOL', 'MACRO'],
    tags: ['macro', 'bitcoin', 'analysis'],
    smart: 0.86,
    influence: 0.88,
    early: 0.72,
    authority: 0.82,
    handshake: 0.78,
    networkSize: 1100,
    followers: 1100000,
    following: 567,
    engagement: 0.0042,
    confidence: 0.86,
    verified: true,
    twitterScore: 86,
    networkScore: 84,
    engagementRate: 0.0042,
    source: 'seed'
  },
  {
    handle: 'lookonchain',
    username: 'lookonchain',
    kind: 'TWITTER',
    title: 'Lookonchain',
    name: 'Lookonchain',
    avatar: 'https://pbs.twimg.com/profile_images/1587729789455753216/PwBLVHqO_400x400.jpg',
    categories: ['ANALYST', 'DATA'],
    tags: ['onchain', 'data', 'whale'],
    smart: 0.82,
    influence: 0.78,
    early: 0.88,
    authority: 0.75,
    handshake: 0.72,
    networkSize: 650,
    followers: 650000,
    following: 123,
    engagement: 0.0065,
    confidence: 0.82,
    verified: true,
    twitterScore: 82,
    networkScore: 76,
    engagementRate: 0.0065,
    source: 'seed'
  },
  // B-tier
  {
    handle: 'hsaka',
    username: 'hsaka',
    kind: 'TWITTER',
    title: 'Hsaka',
    name: 'Hsaka',
    avatar: 'https://pbs.twimg.com/profile_images/1529158961962426368/o8lQDwRT_400x400.jpg',
    categories: ['KOL', 'TRADER'],
    tags: ['trading', 'altcoins'],
    smart: 0.75,
    influence: 0.68,
    early: 0.78,
    authority: 0.65,
    handshake: 0.62,
    networkSize: 420,
    followers: 280000,
    following: 312,
    engagement: 0.0048,
    confidence: 0.75,
    verified: false,
    twitterScore: 75,
    networkScore: 68,
    engagementRate: 0.0048,
    source: 'seed'
  },
  {
    handle: 'pentoshi',
    username: 'pentoshi',
    kind: 'TWITTER',
    title: 'Pentoshi',
    name: 'Pentoshi',
    avatar: 'https://pbs.twimg.com/profile_images/1552364437851824129/dX-e_SaS_400x400.jpg',
    categories: ['KOL', 'TRADER'],
    tags: ['trading', 'ta', 'altcoins'],
    smart: 0.79,
    influence: 0.75,
    early: 0.72,
    authority: 0.68,
    handshake: 0.65,
    networkSize: 580,
    followers: 720000,
    following: 289,
    engagement: 0.0052,
    confidence: 0.79,
    verified: false,
    twitterScore: 79,
    networkScore: 72,
    engagementRate: 0.0052,
    source: 'seed'
  },
  {
    handle: 'brian_armstrong',
    username: 'brian_armstrong',
    kind: 'TWITTER',
    title: 'Brian Armstrong',
    name: 'Brian Armstrong',
    avatar: 'https://pbs.twimg.com/profile_images/1707116189776015360/t7Nse7M2_400x400.jpg',
    categories: ['FOUNDER', 'EXCHANGE'],
    tags: ['coinbase', 'cex', 'regulation'],
    smart: 0.91,
    influence: 0.92,
    early: 0.75,
    authority: 0.95,
    handshake: 0.88,
    networkSize: 1400,
    followers: 1400000,
    following: 156,
    engagement: 0.0028,
    confidence: 0.91,
    verified: true,
    twitterScore: 91,
    networkScore: 88,
    engagementRate: 0.0028,
    source: 'seed'
  }
];

async function seed() {
  console.log('[Seed Unified] Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  
  const db = client.db('connections_db');
  const collection = db.collection('connections_unified_accounts');
  
  console.log('[Seed Unified] Clearing existing data...');
  await collection.deleteMany({});
  
  console.log('[Seed Unified] Inserting accounts...');
  for (const acc of unifiedAccounts) {
    await collection.updateOne(
      { handle: acc.handle },
      { $set: { ...acc, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  
  // Create indexes
  await collection.createIndex({ handle: 1 }, { unique: true, sparse: true }).catch(() => {});
  await collection.createIndex({ smart: -1 }).catch(() => {});
  await collection.createIndex({ influence: -1 }).catch(() => {});
  await collection.createIndex({ categories: 1 }).catch(() => {});
  await collection.createIndex({ source: 1 }).catch(() => {});
  
  const count = await collection.countDocuments();
  console.log(`[Seed Unified] ✅ Seeded ${count} unified accounts`);
  
  await client.close();
}

seed().catch(console.error);
