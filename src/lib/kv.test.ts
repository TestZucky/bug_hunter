import { describe, expect, it } from "vitest";
import { getKv } from "@/lib/kv";

// Backend-agnostic: runs against the in-memory KV locally, or Redis in CI when
// REDIS_URL is set (with a reachable server).
describe("kv", () => {
  it("incr counts up within a window", async () => {
    const kv = getKv();
    const k = `kv-incr-${Date.now()}`;
    expect(await kv.incr(k, 60_000)).toBe(1);
    expect(await kv.incr(k, 60_000)).toBe(2);
  });

  it("setJSON / getJSON / del round-trips", async () => {
    const kv = getKv();
    const k = `kv-json-${Date.now()}`;
    await kv.setJSON(k, { a: 1, b: "x" }, 60_000);
    expect(await kv.getJSON(k)).toEqual({ a: 1, b: "x" });
    await kv.del(k);
    expect(await kv.getJSON(k)).toBeNull();
  });
});
