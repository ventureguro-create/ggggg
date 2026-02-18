/**
 * Telegram Runtime - Production Hardened
 * 
 * Features:
 * - Rate limiting (global + per-method)
 * - Retry/backoff with exponential delay
 * - FLOOD_WAIT handling (auto-pause)
 * - Entity cache (LRU)
 * - Safe shutdown
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';

import { RateLimiter } from './rate_limiter.js';
import { withRetry } from './retry.js';
import { EntityCache } from './entity_cache.js';
import { TgSessionStore } from './file_session_store.js';

export function normalizeUsername(x: string): string {
  const s = (x || '').trim();
  const noAt = s.startsWith('@') ? s.slice(1) : s;
  const noTme = noAt.replace(/^https?:\/\/t\.me\//i, '').replace(/^t\.me\//i, '');
  return noTme.split(/[/?#]/)[0].toLowerCase();
}

type RuntimeOpts = {
  apiId: number;
  apiHash: string;
  sessionStore: TgSessionStore;

  rpsGlobal: number;
  rpsResolve: number;
  rpsHistory: number;

  maxRetries: number;
  retryBaseMs: number;

  log: (msg: string, meta?: any) => void;
};

export class TelegramRuntime {
  private client!: TelegramClient;
  private session!: StringSession;
  private started = false;

  private limiter: RateLimiter;
  private entityCache = new EntityCache<any>(800, 6 * 60 * 60 * 1000);

  constructor(private opts: RuntimeOpts) {
    this.limiter = new RateLimiter(opts.rpsGlobal);
  }

  async start() {
    if (this.started) return;

    const saved = await this.opts.sessionStore.load();
    this.session = new StringSession(saved ?? '');

    this.client = new TelegramClient(this.session, this.opts.apiId, this.opts.apiHash, {
      connectionRetries: 5,
    });

    // For development/CI: skip interactive auth if no API credentials
    if (!this.opts.apiId || !this.opts.apiHash) {
      this.opts.log('[TG] No API credentials, running in mock mode');
      return;
    }

    try {
      // Use dynamic import for input to handle environments without TTY
      const input = await import('input');
      
      await this.client.start({
        phoneNumber: async () => await input.default.text('Telegram phone (+380...): '),
        password: async () => await input.default.text('2FA password (if set): '),
        phoneCode: async () => await input.default.text('Code from Telegram: '),
        onError: (err) => this.opts.log('[TG] auth error', { err: String(err) }),
      });

      await this.opts.sessionStore.save(this.client.session.save() as unknown as string);
      this.started = true;
      this.opts.log('[TG] runtime started');
    } catch (err: any) {
      this.opts.log('[TG] start error (may need interactive auth)', { err: String(err?.message || err) });
      // Don't throw - allow mock mode
    }
  }

  async stop() {
    try {
      await this.client?.disconnect();
    } catch {}
  }

  isConnected(): boolean {
    return this.started && !!this.client;
  }

  getClient() {
    if (!this.client) throw new Error('TelegramRuntime not started');
    return this.client;
  }

  async resolve(username: string) {
    if (!this.started) throw new Error('Runtime not connected');
    
    const clean = normalizeUsername(username);
    const cached = this.entityCache.get(clean);
    if (cached) return cached;

    await this.limiter.wait('resolve', this.opts.rpsResolve);

    const entity = await withRetry(
      () => this.client.getEntity(clean),
      {
        maxRetries: this.opts.maxRetries,
        baseMs: this.opts.retryBaseMs,
        onRetry: (e, a, w) => this.opts.log('[TG] resolve retry', { clean, a, w, e: String(e?.message || e) }),
        onFloodWait: (sec) => this.opts.log('[TG] FLOOD_WAIT resolve', { clean, sec }),
      }
    );

    this.entityCache.set(clean, entity);
    return entity;
  }

  async getFullChannel(entity: any) {
    if (!this.started) throw new Error('Runtime not connected');
    
    await this.limiter.wait('full', this.opts.rpsResolve);

    return withRetry(
      () => this.client.invoke(new Api.channels.GetFullChannel({ channel: entity })),
      {
        maxRetries: this.opts.maxRetries,
        baseMs: this.opts.retryBaseMs,
        onRetry: (e, a, w) => this.opts.log('[TG] fullChannel retry', { a, w, e: String(e?.message || e) }),
        onFloodWait: (sec) => this.opts.log('[TG] FLOOD_WAIT fullChannel', { sec }),
      }
    );
  }

  async iterMessages(entity: any, params: any) {
    if (!this.started) throw new Error('Runtime not connected');
    
    await this.limiter.wait('history', this.opts.rpsHistory);
    return this.client.iterMessages(entity, params);
  }
}
