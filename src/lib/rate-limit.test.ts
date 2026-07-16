import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit (in-memory KV)", () => {
  it("allows up to the limit, then blocks with a retry hint", async () => {
    const key = "unit-test-bucket";
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(key, 3, 60_000)).ok).toBe(true);
    }
    const blocked = await rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", async () => {
    expect((await rateLimit("key-a", 1, 60_000)).ok).toBe(true);
    expect((await rateLimit("key-b", 1, 60_000)).ok).toBe(true);
    expect((await rateLimit("key-a", 1, 60_000)).ok).toBe(false);
  });
});
