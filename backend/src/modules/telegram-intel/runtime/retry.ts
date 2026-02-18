/**
 * Retry/Backoff + FLOOD_WAIT handling
 */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseFloodWaitSeconds(err: any): number | null {
  const msg = String(err?.message || err?.errorMessage || '');
  const m = msg.match(/FLOOD_WAIT_?(\d+)/i);
  if (m?.[1]) return Number(m[1]);
  return null;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    maxRetries: number;
    baseMs: number;
    onRetry?: (e: any, attempt: number, waitMs: number) => void;
    onFloodWait?: (sec: number) => void;
  }
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      const flood = parseFloodWaitSeconds(e);
      if (flood) {
        opts.onFloodWait?.(flood);
        await sleep((flood + 1) * 1000);
        continue;
      }

      attempt += 1;
      if (attempt > opts.maxRetries) throw e;

      const jitter = Math.floor(Math.random() * 250);
      const waitMs = Math.min(15000, opts.baseMs * Math.pow(1.6, attempt - 1) + jitter);
      opts.onRetry?.(e, attempt, waitMs);
      await sleep(waitMs);
    }
  }
}
