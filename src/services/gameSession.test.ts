import { describe, expect, it } from "vitest";
import { FIXTURE_CHALLENGES } from "@/test/fixtures";

// Needs the DB (challenge lookups). CI provides Postgres; local `npm test`
// without DATABASE_URL skips it. Uses the in-memory KV unless REDIS_URL is set.
const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("gameSession anti-cheat (DB integration)", () => {
  it("enforces round/stage order and blocks enumeration", async () => {
    const { upsertMany } = await import("@/db/challenges.repo");
    const { createSession, gradeInSession } = await import(
      "@/services/gameSession"
    );
    // Published: a session can only be built from challenges players can see.
    await upsertMany(FIXTURE_CHALLENGES, "test", "published");

    const { sessionId } = await createSession("mixed", 3);

    // Round 0 starts at the "line" stage → submitting a diagnosis is out of order.
    expect((await gradeInSession(sessionId, 0, "diagnosis", "dX")).status).toBe(
      "conflict",
    );

    // Forfeiting resolves the round and returns the reveal.
    const forfeit = await gradeInSession(sessionId, 0, "forfeit", null);
    expect(forfeit.status).toBe("ok");
    expect(forfeit.reveal).toBeTruthy();

    // The round is now resolved — any further submission for it is rejected
    // (this is what stops an attacker enumerating the options).
    expect((await gradeInSession(sessionId, 0, "diagnosis", "dY")).status).toBe(
      "conflict",
    );

    // Unknown session id is rejected.
    expect(
      (await gradeInSession("does-not-exist", 0, "line", "l1")).status,
    ).toBe("notfound");
  });
});
