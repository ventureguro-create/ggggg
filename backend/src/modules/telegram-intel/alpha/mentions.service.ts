/**
 * Token Mentions Service
 * Scans posts for token mentions and persists them
 * Phase 3: Alpha & Credibility Engine - Step 1
 */
import { TgPostModel } from '../models_compat/tg.post.model.js';
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';
import { extractTokens } from './token_extractor.js';

export class TokenMentionsService {
  constructor(private log: (msg: string, meta?: any) => void) {}

  /**
   * Scan channel posts and extract token mentions
   */
  async scanChannel(username: string, days = 30, minConfidence = 0.35) {
    const since = new Date(Date.now() - days * 86400000);
    const normalizedUsername = username.toLowerCase();

    const posts = await TgPostModel.find({
      channelUsername: normalizedUsername,
      date: { $gte: since },
      text: { $exists: true, $ne: '' },
    })
      .select('channelUsername messageId date text')
      .limit(20000)
      .lean();

    let created = 0;
    let scanned = 0;
    let duplicates = 0;

    for (const p of posts) {
      scanned += 1;

      const tokens = extractTokens(String((p as any).text || '')).filter(
        (t) => t.confidence >= minConfidence
      );
      if (!tokens.length) continue;

      for (const t of tokens) {
        const postId = `${normalizedUsername}:${Number((p as any).messageId)}`;

        try {
          const result = await TgTokenMentionModel.updateOne(
            { postId, token: t.token },
            {
              $setOnInsert: {
                username: normalizedUsername,
                token: t.token,
                mentionedAt: new Date((p as any).date),
                postId,
                messageId: Number((p as any).messageId),
                context: {
                  snippet: t.snippet.slice(0, 240),
                  source: t.source,
                  confidence: t.confidence,
                },
                evaluated: false,
              },
            },
            { upsert: true }
          );

          if (result.upsertedCount > 0) {
            created += 1;
          } else {
            duplicates += 1;
          }
        } catch (err: any) {
          // duplicate key → already exists
          if (err?.code === 11000) {
            duplicates += 1;
          }
        }
      }
    }

    this.log('[alpha] scan done', {
      username: normalizedUsername,
      days,
      scanned,
      created,
      duplicates,
    });

    return {
      ok: true,
      username: normalizedUsername,
      days,
      postsScanned: scanned,
      mentionsCreated: created,
      duplicatesSkipped: duplicates,
    };
  }

  /**
   * List token mentions for a channel
   */
  async listMentions(username: string, days = 30, limit = 200) {
    const since = new Date(Date.now() - days * 86400000);
    const normalizedUsername = username.toLowerCase();

    const items = await TgTokenMentionModel.find({
      username: normalizedUsername,
      mentionedAt: { $gte: since },
    })
      .sort({ mentionedAt: -1 })
      .limit(Math.max(1, Math.min(1000, limit)))
      .select('-_id -__v')
      .lean();

    // Aggregate by token for summary
    const tokenCounts = new Map<string, number>();
    for (const item of items) {
      const count = tokenCounts.get(item.token) || 0;
      tokenCounts.set(item.token, count + 1);
    }

    const topTokens = [...tokenCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([token, count]) => ({ token, count }));

    return {
      ok: true,
      username: normalizedUsername,
      days,
      totalMentions: items.length,
      topTokens,
      mentions: items,
    };
  }

  /**
   * Get aggregate stats across all channels
   */
  async getStats(days = 30) {
    const since = new Date(Date.now() - days * 86400000);

    const [totalMentions, uniqueTokens, topTokens, topChannels] = await Promise.all([
      TgTokenMentionModel.countDocuments({ mentionedAt: { $gte: since } }),
      TgTokenMentionModel.distinct('token', { mentionedAt: { $gte: since } }),
      TgTokenMentionModel.aggregate([
        { $match: { mentionedAt: { $gte: since } } },
        { $group: { _id: '$token', count: { $sum: 1 }, avgConfidence: { $avg: '$context.confidence' } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
        { $project: { token: '$_id', count: 1, avgConfidence: { $round: ['$avgConfidence', 2] }, _id: 0 } },
      ]),
      TgTokenMentionModel.aggregate([
        { $match: { mentionedAt: { $gte: since } } },
        { $group: { _id: '$username', count: { $sum: 1 }, uniqueTokens: { $addToSet: '$token' } } },
        { $project: { username: '$_id', count: 1, uniqueTokens: { $size: '$uniqueTokens' }, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    return {
      ok: true,
      days,
      totalMentions,
      uniqueTokensCount: uniqueTokens.length,
      topTokens,
      topChannels,
    };
  }
}
