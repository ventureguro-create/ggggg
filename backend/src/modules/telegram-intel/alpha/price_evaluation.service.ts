/**
 * Price Evaluation Service
 * Batch job to evaluate token mentions with price data
 * 
 * For each unevaluated mention:
 * 1. Fetch price at mention time
 * 2. Fetch prices at +24h, +7d, +30d
 * 3. Calculate returns
 * 4. Mark as evaluated
 */
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';
import { AlphaPriceService } from '../price/price.service.js';

export class PriceEvaluationService {
  private priceSvc: AlphaPriceService;
  private log: (msg: string, meta?: any) => void;

  constructor(log?: (msg: string, meta?: any) => void) {
    this.log = log || console.log;
    this.priceSvc = new AlphaPriceService(this.log);
  }

  /**
   * Evaluate a batch of unevaluated mentions
   */
  async evaluateBatch(limit = 50): Promise<{
    ok: boolean;
    processed: number;
    evaluated: number;
    skipped: number;
    errors: number;
  }> {
    // Get oldest unevaluated mentions
    const mentions = await TgTokenMentionModel.find({ evaluated: false })
      .sort({ mentionedAt: 1 })
      .limit(Math.min(limit, 200))
      .lean();

    if (!mentions.length) {
      return { ok: true, processed: 0, evaluated: 0, skipped: 0, errors: 0 };
    }

    let evaluated = 0;
    let skipped = 0;
    let errors = 0;

    for (const m of mentions) {
      try {
        const result = await this.priceSvc.getPriceWithReturns(
          (m as any).token,
          new Date((m as any).mentionedAt)
        );

        if (!result.priceAtMention) {
          // Token not found or no price data - mark as evaluated but with null values
          await TgTokenMentionModel.updateOne(
            { _id: (m as any)._id },
            {
              $set: {
                evaluated: true,
                priceAtMention: null,
                returns: { r24h: null, r7d: null, r30d: null, max7d: null },
              },
            }
          );
          skipped++;
          continue;
        }

        // Update with price data
        await TgTokenMentionModel.updateOne(
          { _id: (m as any)._id },
          {
            $set: {
              evaluated: true,
              priceAtMention: result.priceAtMention,
              returns: {
                r24h: result.r24h,
                r7d: result.r7d,
                r30d: result.r30d,
                max7d: result.max7d,
              },
            },
          }
        );

        evaluated++;
      } catch (err: any) {
        this.log('[evaluation] Error processing mention', {
          token: (m as any).token,
          err: err?.message || err,
        });
        errors++;
      }
    }

    this.log('[evaluation] Batch complete', {
      processed: mentions.length,
      evaluated,
      skipped,
      errors,
    });

    return {
      ok: true,
      processed: mentions.length,
      evaluated,
      skipped,
      errors,
    };
  }

  /**
   * Get evaluation stats
   */
  async getStats(): Promise<{
    total: number;
    evaluated: number;
    pending: number;
    withPriceData: number;
    avgReturn24h: number | null;
    avgReturn7d: number | null;
  }> {
    const [total, evaluated, withPriceData, avgReturns] = await Promise.all([
      TgTokenMentionModel.countDocuments(),
      TgTokenMentionModel.countDocuments({ evaluated: true }),
      TgTokenMentionModel.countDocuments({
        evaluated: true,
        priceAtMention: { $ne: null },
      }),
      TgTokenMentionModel.aggregate([
        { $match: { evaluated: true, 'returns.r24h': { $ne: null } } },
        {
          $group: {
            _id: null,
            avgR24h: { $avg: '$returns.r24h' },
            avgR7d: { $avg: '$returns.r7d' },
          },
        },
      ]),
    ]);

    return {
      total,
      evaluated,
      pending: total - evaluated,
      withPriceData,
      avgReturn24h: avgReturns[0]?.avgR24h ?? null,
      avgReturn7d: avgReturns[0]?.avgR7d ?? null,
    };
  }

  /**
   * Re-evaluate mentions that need updated returns
   * (e.g., mentions where 7d/30d returns are now available)
   */
  async reevaluateIncomplete(limit = 30): Promise<{
    ok: boolean;
    updated: number;
  }> {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Find mentions that:
    // - Have priceAtMention
    // - Are old enough for 7d return but r7d is null
    // - OR are old enough for 30d return but r30d is null
    const mentions = await TgTokenMentionModel.find({
      evaluated: true,
      priceAtMention: { $ne: null },
      $or: [
        {
          mentionedAt: { $lt: sevenDaysAgo },
          'returns.r7d': null,
        },
        {
          mentionedAt: { $lt: thirtyDaysAgo },
          'returns.r30d': null,
        },
      ],
    })
      .sort({ mentionedAt: 1 })
      .limit(limit)
      .lean();

    let updated = 0;

    for (const m of mentions) {
      try {
        const result = await this.priceSvc.getPriceWithReturns(
          (m as any).token,
          new Date((m as any).mentionedAt)
        );

        if (result.r7d !== null || result.r30d !== null) {
          await TgTokenMentionModel.updateOne(
            { _id: (m as any)._id },
            {
              $set: {
                'returns.r7d': result.r7d ?? (m as any).returns?.r7d,
                'returns.r30d': result.r30d ?? (m as any).returns?.r30d,
              },
            }
          );
          updated++;
        }
      } catch (err) {
        // Continue with next
      }
    }

    return { ok: true, updated };
  }
}
