/**
 * Price Cache Model
 * MongoDB cache for CoinGecko price data
 * Prevents excessive API calls
 */
import mongoose, { Schema } from 'mongoose';

const TgPriceCacheSchema = new Schema(
  {
    token: { type: String, index: true },         // normalized ticker (UPPER)
    dateKey: { type: String, index: true },       // YYYY-MM-DD
    priceUSD: Number,
    source: { type: String, default: 'coingecko' },
  },
  { timestamps: true, collection: 'tg_price_cache' }
);

// One price per token per day
TgPriceCacheSchema.index({ token: 1, dateKey: 1 }, { unique: true });

// TTL index - expire after 90 days (optional cleanup)
TgPriceCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });

export const TgPriceCacheModel =
  mongoose.models.TgPriceCache || mongoose.model('TgPriceCache', TgPriceCacheSchema);
