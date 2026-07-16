import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit, then blocks with a retry hint", () => {
    const key = "unit-test-bucket";
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    expect(rateLimit("key-a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("key-b", 1, 60_000).ok).toBe(true);
    expect(rateLimit("key-a", 1, 60_000).ok).toBe(false);
  });
});
