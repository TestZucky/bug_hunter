import Redis from "ioredis";

/**
 * Tiny key-value abstraction used by rate limiting and server sessions.
 *
 * - In-memory by default (fine for a single long-running instance / dev / tests).
 * - Redis (ioredis) when REDIS_URL is set — required for multi-instance /
 *   serverless deploys so counters and sessions are shared.
 *
 * Server-only: importing `ioredis` keeps this out of client bundles.
 */

export interface Kv {
  /** Increment a counter; set TTL on first increment. Returns the new count. */
  incr(key: string, ttlMs: number): Promise<number>;
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
}

// ── In-memory backend ────────────────────────────────────────────────────────

class MemoryKv implements Kv {
  private counters = new Map<string, { count: number; resetAt: number }>();
  private store = new Map<string, { value: string; expireAt: number }>();

  private sweep(now: number) {
    if (this.counters.size + this.store.size < 10000) return;
    for (const [k, v] of this.counters)
      if (now >= v.resetAt) this.counters.delete(k);
    for (const [k, v] of this.store)
      if (now >= v.expireAt) this.store.delete(k);
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const now = Date.now();
    this.sweep(now);
    let c = this.counters.get(key);
    if (!c || now >= c.resetAt) {
      c = { count: 0, resetAt: now + ttlMs };
      this.counters.set(key, c);
    }
    c.count += 1;
    return c.count;
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() >= e.expireAt) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(e.value) as T;
  }

  async setJSON(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expireAt: Date.now() + ttlMs,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ── Redis backend ────────────────────────────────────────────────────────────

class RedisKv implements Kv {
  constructor(private redis: Redis) {}

  async incr(key: string, ttlMs: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.pexpire(key, ttlMs);
    return count;
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJSON(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "PX", ttlMs);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// ── Selection (singleton across hot reloads) ─────────────────────────────────

const globalForKv = globalThis as unknown as { __bhKv?: Kv; __bhRedis?: Redis };

export function getKv(): Kv {
  if (globalForKv.__bhKv) return globalForKv.__bhKv;
  const url = process.env.REDIS_URL;
  let kv: Kv;
  if (url) {
    const redis =
      globalForKv.__bhRedis ??
      new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    globalForKv.__bhRedis = redis;
    kv = new RedisKv(redis);
  } else {
    kv = new MemoryKv();
  }
  globalForKv.__bhKv = kv;
  return kv;
}

/** True when a shared (Redis) store is configured. */
export function hasSharedKv(): boolean {
  return !!process.env.REDIS_URL;
}
