import { NextResponse, type NextRequest } from "next/server";
import { getKv } from "./kv";
import { describeError, logger } from "./logger";

/**
 * Fixed-window per-key rate limiting on top of the KV store. With REDIS_URL set
 * the window is shared across instances; otherwise it's per-instance in-memory.
 * Fails OPEN — if the store is unavailable we allow the request rather than
 * lock everyone out.
 */

export interface RateLimitResult {
  ok: boolean;
  count: number;
  retryAfterSec: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const count = await getKv().incr(`rl:${key}`, windowMs);
    const ok = count <= limit;
    return { ok, count, retryAfterSec: ok ? 0 : Math.ceil(windowMs / 1000) };
  } catch (err) {
    logger.warn("Rate limiter store unavailable — allowing request", {
      ...describeError(err),
    });
    return { ok: true, count: 0, retryAfterSec: 0 };
  }
}

/** Best-effort client IP (honors proxy headers set by Vercel/nginx). */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Apply a limit to a request; returns a 429 response if exceeded, else null. */
export async function enforceRateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const { ok, retryAfterSec } = await rateLimit(
    `${bucket}:${clientIp(req)}`,
    limit,
    windowMs,
  );
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}
