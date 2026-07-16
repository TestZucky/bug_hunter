import { describe, expect, it } from "vitest";
import { getLevel, getRankProgress, RANKS } from "@/lib/ranks";

describe("ranks", () => {
  it("0 XP is the first rank", () => {
    expect(getRankProgress(0).rank.name).toBe(RANKS[0].name);
  });

  it("very high XP is the top rank with no next", () => {
    const p = getRankProgress(999_999);
    expect(p.rank.name).toBe(RANKS[RANKS.length - 1].name);
    expect(p.next).toBeNull();
  });

  it("progress stays within 0..100", () => {
    for (const xp of [0, 250, 750, 1500, 5000, 12000]) {
      const p = getRankProgress(xp).progress;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });

  it("level is monotonic in XP", () => {
    expect(getLevel(10000)).toBeGreaterThan(getLevel(0));
  });
});
