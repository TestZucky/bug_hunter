import { NextResponse, type NextRequest } from "next/server";

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Good enough as a first abuse layer on a single instance. For a multi-instance
 * / serverless deploy, back it with Redis (e.g. Upstash) — the interface stays
 * the same. Counters reset on restart.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Occasionally sweep expired windows so the map can't grow unbounded.
function sweep(now: number) {
  if (windows.size < 5000) return;
  for (const [key, w] of windows) if (now >= w.resetAt) windows.delete(key);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  let w = windows.get(key);
  if (!w || now >= w.resetAt) {
    w = { count: 0, resetAt: now + windowMs };
    windows.set(key, w);
  }
  w.count += 1;
  const ok = w.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - w.count),
    retryAfterSec: ok ? 0 : Math.ceil((w.resetAt - now) / 1000),
  };
}

/** Best-effort client IP (honors proxy headers set by Vercel/nginx). */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Apply a limit to a request; returns a 429 response if exceeded, else null. */
export function enforceRateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const { ok, remaining, retryAfterSec } = rateLimit(
    `${bucket}:${clientIp(req)}`,
    limit,
    windowMs,
  );
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Remaining": String(remaining),
      },
    },
  );
}
