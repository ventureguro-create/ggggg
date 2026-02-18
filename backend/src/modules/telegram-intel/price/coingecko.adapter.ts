/**
 * CoinGecko Adapter
 * Rate-limited adapter for CoinGecko API
 * 
 * Free tier limits:
 * - 10-30 calls/minute
 * - ~0.5 calls/second safe margin
 */
import axios from 'axios';

const BASE = 'https://api.coingecko.com/api/v3';
const REQUEST_INTERVAL = 2000; // 2 seconds between requests (safe margin)
const MAX_RETRIES = 3;

// Optional API key for CoinGecko Pro/Demo tier
const API_KEY = process.env.COINGECKO_API_KEY || '';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers['x-cg-demo-api-key'] = API_KEY;
  }
  return headers;
}

let lastCall = 0;
let coinListCache: Array<{ id: string; symbol: string; name: string }> | null = null;
let coinListCacheTime = 0;
const COIN_LIST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function rateLimit() {
  const now = Date.now();
  const wait = Math.max(0, REQUEST_INTERVAL - (now - lastCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.response?.status;
      
      // Rate limit hit - wait longer
      if (status === 429) {
        const waitTime = (i + 1) * 5000;
        console.log(`[CoinGecko] Rate limit hit, waiting ${waitTime}ms...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      
      // Not found or Unauthorized - don't retry
      if (status === 404 || status === 401) {
        if (status === 401) {
          console.log('[CoinGecko] 401 Unauthorized - may need API key');
        }
        return null;
      }
      
      // Server error - retry with backoff
      if (status >= 500) {
        await new Promise((r) => setTimeout(r, (i + 1) * 1000));
        continue;
      }
      
      // Other error
      console.error(`[CoinGecko] Request failed:`, err?.message || err);
      return null;
    }
  }
  return null;
}

export class CoinGeckoAdapter {
  private symbolToIdMap = new Map<string, string>();

  /**
   * Get CoinGecko coin ID by symbol
   * Caches the full coin list for 24h
   */
  async getCoinIdBySymbol(symbol: string): Promise<string | null> {
    const upperSymbol = symbol.toUpperCase();
    
    // Check local map first
    if (this.symbolToIdMap.has(upperSymbol)) {
      return this.symbolToIdMap.get(upperSymbol)!;
    }

    // Refresh coin list if needed
    if (!coinListCache || Date.now() - coinListCacheTime > COIN_LIST_CACHE_TTL) {
      await rateLimit();
      const data = await fetchWithRetry(async () => {
        const res = await axios.get(`${BASE}/coins/list`);
        return res.data;
      });
      
      if (data) {
        coinListCache = data;
        coinListCacheTime = Date.now();
        
        // Build symbol -> id map for common lookups
        for (const coin of data) {
          const sym = coin.symbol?.toUpperCase();
          if (sym && !this.symbolToIdMap.has(sym)) {
            this.symbolToIdMap.set(sym, coin.id);
          }
        }
      }
    }

    // Search in cache
    if (coinListCache) {
      const match = coinListCache.find(
        (c) => c.symbol?.toUpperCase() === upperSymbol
      );
      if (match) {
        this.symbolToIdMap.set(upperSymbol, match.id);
        return match.id;
      }
    }

    return null;
  }

  /**
   * Get historical price for a specific date
   * Note: CoinGecko free tier has limited historical data
   */
  async getHistoricalPriceUSD(coinId: string, date: Date): Promise<number | null> {
    // Format: dd-mm-yyyy
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    await rateLimit();
    
    const data = await fetchWithRetry(async () => {
      const res = await axios.get(`${BASE}/coins/${coinId}/history`, {
        params: { date: dateStr, localization: false },
      });
      return res.data;
    });

    return data?.market_data?.current_price?.usd || null;
  }

  /**
   * Get current price
   */
  async getCurrentPriceUSD(coinId: string): Promise<number | null> {
    await rateLimit();
    
    const data = await fetchWithRetry(async () => {
      const res = await axios.get(`${BASE}/simple/price`, {
        params: {
          ids: coinId,
          vs_currencies: 'usd',
        },
      });
      return res.data;
    });

    return data?.[coinId]?.usd || null;
  }

  /**
   * Batch get current prices for multiple coins
   */
  async getBatchCurrentPrices(coinIds: string[]): Promise<Record<string, number>> {
    if (!coinIds.length) return {};
    
    await rateLimit();
    
    const data = await fetchWithRetry(async () => {
      const res = await axios.get(`${BASE}/simple/price`, {
        params: {
          ids: coinIds.join(','),
          vs_currencies: 'usd',
        },
      });
      return res.data;
    });

    const result: Record<string, number> = {};
    if (data) {
      for (const id of coinIds) {
        if (data[id]?.usd) {
          result[id] = data[id].usd;
        }
      }
    }
    
    return result;
  }
}
