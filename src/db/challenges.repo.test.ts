import { describe, expect, it } from "vitest";
import { FIXTURE_CHALLENGES } from "@/test/fixtures";

// Only runs when a database is configured (CI provides one; local `npm test`
// without DATABASE_URL skips it). The DB must already be migrated.
const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("challenges repo (DB integration)", () => {
  it("upserts, reads, and builds a run", async () => {
    const { upsertMany, getPool, getById, buildRun } = await import(
      "@/db/challenges.repo"
    );
    await upsertMany(FIXTURE_CHALLENGES, "test");

    const jsPool = await getPool("javascript");
    expect(jsPool.every((c) => c.language === "javascript")).toBe(true);
    expect(jsPool.length).toBeGreaterThanOrEqual(2);

    const one = await getById("fix-easy-1");
    expect(one?.id).toBe("fix-easy-1");
    // The full record retains answers server-side.
    expect(one?.bugLineIds).toContain("l1");

    const run = await buildRun("mixed", 3);
    expect(run.length).toBeGreaterThanOrEqual(1);
  });
});
