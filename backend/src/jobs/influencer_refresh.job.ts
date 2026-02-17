/**
 * Influencer Auto-Refresh Job
 * Periodically fetches new crypto influencers from Twitter and updates scores
 * Uses Twitter Execution Adapter with proper session/cookies handling
 */
import { getMongoDb } from '../db/mongoose.js';
import { importFromSearchResult } from '../modules/connections/unified/twitter-importer.service.js';
import { twitterExecutionAdapter } from '../modules/twitter/execution/execution.adapter.js';

const SEARCH_QUERIES = [
  'crypto alpha',
  'defi alpha',
  'bitcoin whale',
  'ethereum founder',
  'nft influencer',
  'solana ecosystem',
  'web3 builder',
  'crypto vc',
  'defi degen',
  'memecoin trader'
];

// VC and Funds specific queries
const VC_QUERIES = [
  'crypto venture capital',
  'blockchain vc fund',
  'a16z crypto',
  'paradigm crypto',
  'polychain capital',
  'multicoin capital',
  'pantera capital',
  'sequoia crypto',
  'andreessen horowitz web3',
  'crypto fund manager',
  'web3 investor',
  'seed round crypto',
  'crypto portfolio manager',
  'venture partner blockchain',
  'crypto angel investor'
];

let lastRunAt: Date | null = null;
let isRunning = false;
let lastError: string | null = null;
let totalImported = 0;

/**
 * Fetch tweets using Twitter Execution Adapter (with proper cookies/sessions)
 */
async function fetchFromParser(query: string, limit: number = 30): Promise<any[]> {
  try {
    // Use execution adapter which handles sessions and cookies properly
    const result = await twitterExecutionAdapter.search(query, limit);
    
    if (!result.ok) {
      console.warn(`[InfluencerRefresh] Search failed for "${query}": ${result.error}`);
      return [];
    }
    
    // Extract tweets from result
    const data = result.data;
    const tweets = Array.isArray(data) ? data : (data?.items || data?.tweets || []);
    
    return tweets;
  } catch (err: any) {
    console.warn(`[InfluencerRefresh] Parser fetch failed for "${query}":`, err?.message || err);
    return [];
  }
}

/**
 * Run influencer refresh job
 */
export async function refreshInfluencers(): Promise<{ imported: number; queries: number }> {
  if (isRunning) {
    console.log('[InfluencerRefresh] Already running, skipping...');
    return { imported: 0, queries: 0 };
  }

  isRunning = true;
  lastError = null;
  let totalNewImported = 0;

  try {
    console.log('[InfluencerRefresh] Starting auto-refresh...');
    
    for (const query of SEARCH_QUERIES) {
      const tweets = await fetchFromParser(query);
      if (tweets.length > 0) {
        const imported = await importFromSearchResult(tweets);
        totalNewImported += imported;
        console.log(`[InfluencerRefresh] Query "${query}": ${tweets.length} tweets -> ${imported} accounts`);
      }
      // Small delay between queries to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    totalImported += totalNewImported;
    lastRunAt = new Date();
    console.log(`[InfluencerRefresh] Completed. Total imported this run: ${totalNewImported}`);
    
    return { imported: totalNewImported, queries: SEARCH_QUERIES.length };
  } catch (err: any) {
    lastError = err.message;
    console.error('[InfluencerRefresh] Error:', err);
    return { imported: 0, queries: 0 };
  } finally {
    isRunning = false;
  }
}

/**
 * Run VC/Funds specific refresh job
 */
export async function refreshVCInfluencers(): Promise<{ imported: number; queries: number }> {
  if (isRunning) {
    console.log('[InfluencerRefresh] Already running, skipping...');
    return { imported: 0, queries: 0 };
  }

  isRunning = true;
  lastError = null;
  let totalNewImported = 0;

  try {
    console.log('[InfluencerRefresh] Starting VC/Funds refresh...');
    
    for (const query of VC_QUERIES) {
      const tweets = await fetchFromParser(query, 50); // More tweets for VC queries
      if (tweets.length > 0) {
        const imported = await importFromSearchResult(tweets, ['VC', 'INFLUENCE']); // Add VC category
        totalNewImported += imported;
        console.log(`[InfluencerRefresh] VC Query "${query}": ${tweets.length} tweets -> ${imported} accounts`);
      }
      // Small delay between queries to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    totalImported += totalNewImported;
    lastRunAt = new Date();
    console.log(`[InfluencerRefresh] VC refresh completed. Total imported: ${totalNewImported}`);
    
    return { imported: totalNewImported, queries: VC_QUERIES.length };
  } catch (err: any) {
    lastError = err.message;
    console.error('[InfluencerRefresh] VC Error:', err);
    return { imported: 0, queries: 0 };
  } finally {
    isRunning = false;
  }
}

/**
 * Get job status
 */
export function getInfluencerRefreshStatus() {
  return {
    lastRunAt,
    isRunning,
    lastError,
    totalImported,
    searchQueries: SEARCH_QUERIES.length
  };
}

// Auto-start interval (every 10 minutes)
let intervalId: NodeJS.Timeout | null = null;

export function startInfluencerRefreshJob(intervalMinutes: number = 10) {
  if (intervalId) return;
  
  console.log(`[InfluencerRefresh] Starting auto-refresh job (every ${intervalMinutes} min)`);
  
  // Run immediately on start
  refreshInfluencers();
  
  // Then schedule periodic runs
  intervalId = setInterval(() => {
    refreshInfluencers();
  }, intervalMinutes * 60 * 1000);
}

export function stopInfluencerRefreshJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[InfluencerRefresh] Stopped auto-refresh job');
  }
}
