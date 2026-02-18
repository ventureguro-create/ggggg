/**
 * Entity Cache (LRU)
 */
export class EntityCache<T> {
  private map = new Map<string, { v: T; ts: number }>();

  constructor(private max = 500, private ttlMs = 6 * 60 * 60 * 1000) {}

  get(key: string): T | null {
    const x = this.map.get(key);
    if (!x) return null;
    if (Date.now() - x.ts > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    // refresh LRU
    this.map.delete(key);
    this.map.set(key, x);
    return x.v;
  }

  set(key: string, v: T) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { v, ts: Date.now() });

    if (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      if (firstKey) this.map.delete(firstKey);
    }
  }
}
