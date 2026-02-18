/**
 * Alpha Price Service
 * Implements AlphaPriceProvider with MongoDB caching
 * 
 * Features:
 * - CoinGecko adapter with rate limiting
 * - MongoDB cache for historical prices
 * - Symbol to CoinGecko ID resolution
 */
import { AlphaPriceProvider } from './price.provider.js';
import { CoinGeckoAdapter } from './coingecko.adapter.js';
import { TgPriceCacheModel } from './price.cache.model.js';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export class AlphaPriceService implements AlphaPriceProvider {
  private adapter = new CoinGeckoAdapter();
  private symbolToIdCache = new Map<string, string | null>();
  private log: (msg: string, meta?: any) => void;

  constructor(log?: (msg: string, meta?: any) => void) {
    this.log = log || console.log;
  }

  /**
   * Get historical price with caching
   */
  async getHistoricalPriceUSD(token: string, at: Date): Promise<number | null> {
    const upperToken = token.toUpperCase();
    const key = dateKey(at);

    // Check cache first
    const cached = await TgPriceCacheModel.findOne({
      token: upperToken,
      dateKey: key,
    }).lean();

    if (cached) {
      return (cached as any).priceUSD;
    }

    // Resolve CoinGecko ID
    const coinId = await this.resolveCoinId(upperToken);
    if (!coinId) {
      this.log('[price] Unknown token', { token: upperToken });
      return null;
    }

    // Fetch from CoinGecko
    const price = await this.adapter.getHistoricalPriceUSD(coinId, at);
    if (price == null) {
      this.log('[price] No price data', { token: upperToken, date: key });
      return null;
    }

    // Cache the result
    try {
      await TgPriceCacheModel.updateOne(
        { token: upperToken, dateKey: key },
        { $set: { priceUSD: price, source: 'coingecko' } },
        { upsert: true }
      );
    } catch (err: any) {
      // Duplicate key is fine
      if (err?.code !== 11000) {
        this.log('[price] Cache write error', { err: err?.message });
      }
    }

    return price;
  }

  /**
   * Get current price (no caching - always fresh)
   */
  async getCurrentPriceUSD(token: string): Promise<number | null> {
    const upperToken = token.toUpperCase();
    
    const coinId = await this.resolveCoinId(upperToken);
    if (!coinId) return null;

    return this.adapter.getCurrentPriceUSD(coinId);
  }

  /**
   * Get price at mention time + returns at 24h/7d/30d
   * Returns null values for future dates or unavailable data
   */
  async getPriceWithReturns(
    token: string,
    mentionedAt: Date
  ): Promise<{
    priceAtMention: number | null;
    r24h: number | null;
    r7d: number | null;
    r30d: number | null;
    max7d: number | null;
  }> {
    const now = Date.now();
    const mentionTime = mentionedAt.getTime();

    // Get price at mention
    const priceAtMention = await this.getHistoricalPriceUSD(token, mentionedAt);
    if (!priceAtMention) {
      return { priceAtMention: null, r24h: null, r7d: null, r30d: null, max7d: null };
    }

    // Calculate dates for returns
    const date24h = new Date(mentionTime + 24 * 60 * 60 * 1000);
    const date7d = new Date(mentionTime + 7 * 24 * 60 * 60 * 1000);
    const date30d = new Date(mentionTime + 30 * 24 * 60 * 60 * 1000);

    // Only fetch prices for dates in the past
    const [price24h, price7d, price30d] = await Promise.all([
      date24h.getTime() < now ? this.getHistoricalPriceUSD(token, date24h) : null,
      date7d.getTime() < now ? this.getHistoricalPriceUSD(token, date7d) : null,
      date30d.getTime() < now ? this.getHistoricalPriceUSD(token, date30d) : null,
    ]);

    // Calculate returns as percentage
    const calcReturn = (futurePrice: number | null) =>
      futurePrice != null ? ((futurePrice - priceAtMention) / priceAtMention) * 100 : null;

    // For max7d, we'd need to fetch multiple days - simplified to just 7d endpoint
    // In production, could fetch daily prices and find max

    return {
      priceAtMention,
      r24h: calcReturn(price24h),
      r7d: calcReturn(price7d),
      r30d: calcReturn(price30d),
      max7d: null, // Would require fetching all days - TODO in future
    };
  }

  /**
   * Resolve token symbol to CoinGecko ID
   */
  private async resolveCoinId(symbol: string): Promise<string | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check local cache (including negative cache for unknown tokens)
    if (this.symbolToIdCache.has(upperSymbol)) {
      return this.symbolToIdCache.get(upperSymbol) ?? null;
    }

    const id = await this.adapter.getCoinIdBySymbol(upperSymbol);
    
    // Cache result (including null for unknown tokens)
    this.symbolToIdCache.set(upperSymbol, id);
    
    return id;
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    uniqueTokens: number;
    oldestEntry: Date | null;
  }> {
    const [totalCached, uniqueTokens, oldest] = await Promise.all([
      TgPriceCacheModel.countDocuments(),
      TgPriceCacheModel.distinct('token'),
      TgPriceCacheModel.findOne().sort({ createdAt: 1 }).select('createdAt').lean(),
    ]);

    return {
      totalCached,
      uniqueTokens: uniqueTokens.length,
      oldestEntry: (oldest as any)?.createdAt || null,
    };
  }
}
