import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CHALLENGES } from "@/test/fixtures";
import type { Challenge } from "@/types/challenge";

/** Ids the ownership-guard tests create; removed first so reruns are clean. */
const GUARD_IDS = ["guard-collision-1", "guard-same-source-1", "guard-draft-1"];

// Only runs when a database is configured (CI provides one; local `npm test`
// without DATABASE_URL skips it). The DB must already be migrated.
const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("challenges repo (DB integration)", () => {
  beforeEach(async () => {
    const { inArray } = await import("drizzle-orm");
    const { db } = await import("@/db/index");
    const { challenges } = await import("@/db/schema");
    await db.delete(challenges).where(inArray(challenges.id, GUARD_IDS));
  });

  it("upserts, reads, and builds a run", async () => {
    const { upsertMany, getPool, getById, buildRun } = await import(
      "@/db/challenges.repo"
    );
    // Explicitly published: getPool only ever returns published rows.
    await upsertMany(FIXTURE_CHALLENGES, "test", "published");

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

  it("writes drafts by default, keeping unreviewed content away from players", async () => {
    const { upsertMany, getPool, getById } = await import(
      "@/db/challenges.repo"
    );
    const generated: Challenge = {
      ...FIXTURE_CHALLENGES[0],
      id: "guard-draft-1",
      title: "Unreviewed machine output",
    };
    // No status argument — exactly how a careless caller would write.
    await upsertMany([generated], "llm-2026-01-01");

    // The row exists...
    expect((await getById("guard-draft-1"))?.id).toBe("guard-draft-1");
    // ...but the game never serves it.
    const served = await getPool("mixed");
    expect(served.some((c) => c.id === "guard-draft-1")).toBe(false);
  });

  it("publishes a draft only when asked, and reports unknown ids", async () => {
    const { upsertMany, getDrafts, setStatus, getPool } = await import(
      "@/db/challenges.repo"
    );
    const c: Challenge = {
      ...FIXTURE_CHALLENGES[0],
      id: "guard-draft-1",
      title: "Awaiting review",
    };
    await upsertMany([c], "llm-2026-01-01");
    expect((await getDrafts()).some((d) => d.id === "guard-draft-1")).toBe(
      true,
    );

    const changed = await setStatus(
      ["guard-draft-1", "no-such-id"],
      "published",
    );
    expect(changed).toEqual(["guard-draft-1"]);

    expect((await getPool("mixed")).some((x) => x.id === "guard-draft-1")).toBe(
      true,
    );
    expect((await getDrafts()).some((d) => d.id === "guard-draft-1")).toBe(
      false,
    );
  });

  it("deletes drafts but never published challenges", async () => {
    const { upsertMany, deleteDrafts, getById } = await import(
      "@/db/challenges.repo"
    );
    const draft: Challenge = { ...FIXTURE_CHALLENGES[0], id: "guard-draft-1" };
    const live: Challenge = {
      ...FIXTURE_CHALLENGES[0],
      id: "guard-same-source-1",
    };
    await upsertMany([draft], "llm-2026-01-01");
    await upsertMany([live], "llm-2026-01-01", "published");

    // Both ids passed; only the draft may go.
    const removed = await deleteDrafts([
      "guard-draft-1",
      "guard-same-source-1",
    ]);

    expect(removed).toEqual(["guard-draft-1"]);
    expect(await getById("guard-draft-1")).toBeNull();
    expect((await getById("guard-same-source-1"))?.id).toBe(
      "guard-same-source-1",
    );
  });

  it("refuses to overwrite a row owned by a different source", async () => {
    const { upsertMany, getById } = await import("@/db/challenges.repo");
    const original: Challenge = {
      ...FIXTURE_CHALLENGES[0],
      id: "guard-collision-1",
      title: "Original seed challenge",
    };
    await upsertMany([original], "seed");

    // The generator picks its own ids and can collide with a seed one.
    const impostor: Challenge = { ...original, title: "LLM impostor" };
    const report = await upsertMany([impostor], "llm-2026-01-01");

    expect(report.skipped).toEqual([
      { id: "guard-collision-1", existingSource: "seed" },
    ]);
    expect(report.inserted).toEqual([]);
    expect(report.updated).toEqual([]);
    expect((await getById("guard-collision-1"))?.title).toBe(
      "Original seed challenge",
    );
  });

  it("still updates rows the same source owns", async () => {
    const { upsertMany, getById } = await import("@/db/challenges.repo");
    const first: Challenge = {
      ...FIXTURE_CHALLENGES[0],
      id: "guard-same-source-1",
      title: "First version",
    };
    const inserted = await upsertMany([first], "llm-2026-01-01");
    expect(inserted.inserted).toEqual(["guard-same-source-1"]);

    const revised: Challenge = { ...first, title: "Second version" };
    const updated = await upsertMany([revised], "llm-2026-01-01");

    expect(updated.updated).toEqual(["guard-same-source-1"]);
    expect(updated.skipped).toEqual([]);
    expect((await getById("guard-same-source-1"))?.title).toBe(
      "Second version",
    );
  });
});
