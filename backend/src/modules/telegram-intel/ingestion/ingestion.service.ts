/**
 * Ingestion Service - Cursor-based incremental ingestion
 */
import { TelegramRuntime, normalizeUsername } from '../runtime/telegram.runtime.js';
import { TgChannelStateModel } from '../models/tg.channel_state.model.js';
import { fingerprint } from './fingerprint.js';
import { extractMentionsFromText } from '../utils/extract_mentions.js';

import { TgChannelModel } from '../models_compat/tg.channel.model.js';
import { TgPostModel } from '../models_compat/tg.post.model.js';

type IngestOpts = {
  profileRefreshHours: number;
  cooldownMin: number;
  batchLimit: number;
};

export class IngestionService {
  constructor(
    private rt: TelegramRuntime,
    private opts: IngestOpts,
    private log: (msg: string, meta?: any) => void
  ) {}

  async ensureChannelProfile(username: string) {
    const clean = normalizeUsername(username);

    const state = await TgChannelStateModel.findOne({ username: clean }).lean();
    const last = state?.lastProfileAt ? new Date(state.lastProfileAt).getTime() : 0;
    const need = Date.now() - last > this.opts.profileRefreshHours * 3600_000;
    if (!need) return;

    if (!this.rt.isConnected()) {
      // Mock mode - just update timestamp
      await TgChannelStateModel.updateOne(
        { username: clean },
        { $set: { lastProfileAt: new Date() } },
        { upsert: true }
      );
      return;
    }

    const entity = await this.rt.resolve(clean);
    if ((entity as any)?.className !== 'Channel') throw new Error('NOT_A_CHANNEL');

    const full = await this.rt.getFullChannel(entity);

    const title = (entity as any)?.title;
    const about = (full as any)?.fullChat?.about ?? (full as any)?.fullChat?.about;
    const participantsCount =
      (full as any)?.fullChat?.participantsCount ??
      (full as any)?.fullChat?.participants_count;

    await TgChannelModel.updateOne(
      { username: clean },
      {
        $set: {
          channelId: String((entity as any)?.id),
          username: clean,
          title,
          description: about,
          subscriberCount: participantsCount,
          status: 'active',
          lastChecked: new Date(),
        },
        $setOnInsert: { discoveredAt: new Date() },
      },
      { upsert: true }
    );

    await TgChannelStateModel.updateOne(
      { username: clean },
      { $set: { lastProfileAt: new Date(), lastError: '', errorCount: 0 } },
      { upsert: true }
    );

    this.log('[tg] profile refreshed', { username: clean });
  }

  async ingestNewPosts(username: string) {
    const clean = normalizeUsername(username);
    const st = await TgChannelStateModel.findOne({ username: clean }).lean();

    const now = Date.now();
    const nextAllowed = st?.nextAllowedIngestAt ? new Date(st.nextAllowedIngestAt).getTime() : 0;
    if (nextAllowed && now < nextAllowed) {
      return { ok: true, skipped: true, reason: 'cooldown' };
    }

    const lastMessageId = Number(st?.lastMessageId || 0);

    if (!this.rt.isConnected()) {
      // Mock mode - generate mock posts
      const mockPosts = this.generateMockPosts(clean, lastMessageId, 10);
      let inserted = 0;
      let maxId = lastMessageId;

      for (const p of mockPosts) {
        maxId = Math.max(maxId, p.messageId);
        const res = await TgPostModel.updateOne(
          { channelUsername: p.channelUsername, messageId: p.messageId },
          { $setOnInsert: p },
          { upsert: true }
        );
        if ((res as any)?.upsertedCount) inserted += (res as any).upsertedCount;
      }

      await TgChannelStateModel.updateOne(
        { username: clean },
        {
          $set: {
            lastMessageId: maxId,
            lastIngestAt: new Date(),
            nextAllowedIngestAt: new Date(Date.now() + this.opts.cooldownMin * 60_000),
            lastError: '',
            errorCount: 0,
          },
        },
        { upsert: true }
      );

      return { ok: true, inserted, maxId, mode: 'mock' };
    }

    const entity = await this.rt.resolve(clean);
    if ((entity as any)?.className !== 'Channel') throw new Error('NOT_A_CHANNEL');

    const iter = await this.rt.iterMessages(entity, {
      limit: this.opts.batchLimit,
      minId: lastMessageId,
    });

    const collected: any[] = [];
    for await (const msg of iter as any) {
      if (!msg) continue;

      const id = Number((msg as any)?.id);
      if (!id || id <= lastMessageId) continue;

      const text = String((msg as any)?.message || '');
      const mentions = extractMentionsFromText(text);

      const fwdFrom = (msg as any)?.fwdFrom ?? (msg as any)?.forward ?? null;
      let forwardedFrom: any = null;

      try {
        const fromId = (fwdFrom as any)?.fromId ?? (fwdFrom as any)?.from_id ?? null;
        if (fromId) {
          const src = await this.rt.getClient().getEntity(fromId);
          if ((src as any)?.className === 'Channel') {
            forwardedFrom = {
              id: String((src as any)?.id),
              username: (src as any)?.username ? String((src as any)?.username).toLowerCase() : undefined,
              title: (src as any)?.title,
            };
          }
        }
      } catch {}

      const views = (msg as any)?.views;
      const forwards = (msg as any)?.forwards;
      const replies = (msg as any)?.replies?.replies ?? (msg as any)?.replies;

      collected.push({
        postId: `${clean}_${id}`,
        channelId: String((entity as any)?.id),
        channelUsername: clean,
        messageId: id,
        date: new Date((msg as any)?.date * 1000),
        postedAt: new Date((msg as any)?.date * 1000),
        views: typeof views === 'number' ? views : 0,
        forwards: typeof forwards === 'number' ? forwards : 0,
        replies: typeof replies === 'number' ? replies : 0,
        text,
        mentions,
        forwardedFrom,
        hasForward: !!forwardedFrom,
        fingerprint: fingerprint(text),
        ingestedAt: new Date(),
      });
    }

    if (!collected.length) {
      await TgChannelStateModel.updateOne(
        { username: clean },
        {
          $set: {
            lastIngestAt: new Date(),
            nextAllowedIngestAt: new Date(Date.now() + this.opts.cooldownMin * 60_000),
          },
        },
        { upsert: true }
      );
      return { ok: true, inserted: 0 };
    }

    collected.sort((a, b) => a.messageId - b.messageId);

    let maxId = lastMessageId;
    let inserted = 0;

    for (const p of collected) {
      maxId = Math.max(maxId, p.messageId);
      const res = await TgPostModel.updateOne(
        { channelUsername: p.channelUsername, messageId: p.messageId },
        { $setOnInsert: p },
        { upsert: true }
      );
      if ((res as any)?.upsertedCount) inserted += (res as any).upsertedCount;
    }

    await TgChannelStateModel.updateOne(
      { username: clean },
      {
        $set: {
          lastMessageId: maxId,
          lastIngestAt: new Date(),
          nextAllowedIngestAt: new Date(Date.now() + this.opts.cooldownMin * 60_000),
          lastError: '',
          errorCount: 0,
        },
      },
      { upsert: true }
    );

    this.log('[tg] ingested', { username: clean, inserted, maxId });

    return { ok: true, inserted, maxId };
  }

  async ingestChannel(username: string) {
    const clean = normalizeUsername(username);

    try {
      await this.ensureChannelProfile(clean);
      return await this.ingestNewPosts(clean);
    } catch (e: any) {
      await TgChannelStateModel.updateOne(
        { username: clean },
        {
          $set: { lastError: String(e?.message || e) },
          $inc: { errorCount: 1 },
          $setOnInsert: { username: clean },
        },
        { upsert: true }
      );
      this.log('[tg] ingest error', { username: clean, err: String(e?.message || e) });
      throw e;
    }
  }

  /**
   * Generate mock posts for development/testing
   */
  private generateMockPosts(username: string, lastMessageId: number, count: number) {
    const posts = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const messageId = lastMessageId + i + 1;
      const date = new Date(now - (count - i) * 3600000); // 1 hour apart

      posts.push({
        postId: `${username}_${messageId}`,
        channelId: `mock_${username}`,
        channelUsername: username,
        messageId,
        date,
        postedAt: date,
        views: Math.floor(Math.random() * 10000) + 1000,
        forwards: Math.floor(Math.random() * 100),
        replies: Math.floor(Math.random() * 50),
        text: `Mock post #${messageId} from @${username}. $BTC $ETH #crypto`,
        mentions: [],
        hasForward: false,
        fingerprint: fingerprint(`mock post ${messageId}`),
        ingestedAt: new Date(),
      });
    }

    return posts;
  }
}
