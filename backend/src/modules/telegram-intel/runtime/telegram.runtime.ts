/**
 * Telegram Runtime - Production Hardened
 * 
 * Features:
 * - StringSession-only mode (no interactive auth)
 * - Secure secrets loading from encrypted file
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
import { getTelegramSecrets } from './secrets.service.js';

export function normalizeUsername(x: string): string {
  const s = (x || '').trim();
  const noAt = s.startsWith('@') ? s.slice(1) : s;
  const noTme = noAt.replace(/^https?:\/\/t\.me\//i, '').replace(/^t\.me\//i, '');
  return noTme.split(/[/?#]/)[0].toLowerCase();
}

type RuntimeOpts = {
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
  private mockMode = false;

  private limiter: RateLimiter;
  private entityCache = new EntityCache<any>(800, 6 * 60 * 60 * 1000);

  constructor(private opts: RuntimeOpts) {
    this.limiter = new RateLimiter(opts.rpsGlobal);
  }

  async start() {
    if (this.started) return;

    // Load secrets from encrypted file or env vars
    const secrets = getTelegramSecrets();
    
    if (!secrets) {
      this.opts.log('[TG] No credentials found, running in MOCK mode');
      this.opts.log('[TG] Set TG_SECRETS_KEY env var and provide secrets.enc file');
      this.mockMode = true;
      return;
    }

    const { apiId, apiHash, session } = secrets;
    
    if (!apiId || !apiHash || !session) {
      this.opts.log('[TG] Incomplete credentials, running in MOCK mode');
      this.mockMode = true;
      return;
    }

    this.opts.log('[TG] Credentials loaded from secure storage');
    
    // Use StringSession directly - NO interactive auth
    this.session = new StringSession(session);
    
    this.client = new TelegramClient(this.session, apiId, apiHash, {
      connectionRetries: 5,
    });

    try {
      // Connect using existing session (no interactive auth)
      await this.client.connect();
      
      // Verify connection
      const me = await this.client.getMe();
      this.started = true;
      this.opts.log('[TG] Runtime started', { 
        userId: me?.id?.toString(),
        username: (me as any)?.username || 'unknown'
      });
    } catch (err: any) {
      this.opts.log('[TG] Connection failed, running in MOCK mode', { 
        err: String(err?.message || err) 
      });
      this.mockMode = true;
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
