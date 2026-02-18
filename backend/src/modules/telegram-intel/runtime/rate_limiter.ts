/**
 * Rate Limiter (global + per key)
 */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class RateLimiter {
  private last: Record<string, number> = {};

  constructor(private rpsGlobal = 2) {}

  async wait(key = 'global', rpsOverride?: number) {
    const rps = Math.max(0.1, rpsOverride ?? this.rpsGlobal);
    const minInterval = Math.max(250, Math.floor(1000 / rps));

    const now = Date.now();
    const prev = this.last[key] ?? 0;

    const waitMs = Math.max(0, minInterval - (now - prev));
    if (waitMs > 0) await sleep(waitMs);

    this.last[key] = Date.now();
  }
}
