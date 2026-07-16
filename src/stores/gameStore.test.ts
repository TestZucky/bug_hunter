import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toPublicChallenge } from "@/services/challengeService";
import { setGrader, useGameStore } from "@/stores/gameStore";
import { FIXTURE_CHALLENGES, localGrader } from "@/test/fixtures";
import type { SessionConfig } from "@/types/game";

const g = () => useGameStore.getState();
const byId = (id: string) => FIXTURE_CHALLENGES.find((c) => c.id === id)!;
const publicQueue = () => FIXTURE_CHALLENGES.map(toPublicChallenge);

const simple: SessionConfig = {
  mode: "classic",
  language: "javascript",
  difficulty: "adaptive",
  totalRounds: null,
  lives: 3,
  skipFix: true,
  roundSeconds: 60,
  allowRetry: false,
};

async function solveCorrect() {
  const c = g().currentPublic()!;
  const full = byId(c.id);
  g().selectLine(full.bugLineIds[0]);
  await g().submitLine();
  const cd = full.diagnosisOptions.find((o) => o.isCorrect)!;
  g().selectDiagnosis(cd.id);
  await g().submitDiagnosis();
}

describe("gameStore state machine (server-graded)", () => {
  beforeEach(() => {
    setGrader(localGrader(FIXTURE_CHALLENGES));
    g().startSession(simple, "test-session", publicQueue());
  });
  afterAll(() => setGrader(null));

  it("starts in the inspecting state", () => {
    expect(g().status).toBe("inspecting");
  });

  it("plays a full correct round and awards score + combo + reveal", async () => {
    const id = g().currentPublic()!.id;
    await solveCorrect();
    expect(g().status).toBe("round_result");
    expect(g().lastResult?.outcome).toBe("correct");
    expect(g().score).toBeGreaterThan(0);
    expect(g().combo).toBe(1);
    expect(g().lastResult?.correctLineId).toBe(byId(id).bugLineIds[0]);
  });

  it("one-shot: a wrong line fails the round and loses a life", async () => {
    const full = byId(g().currentPublic()!.id);
    const wrong = full.code.find((l) => !full.bugLineIds.includes(l.id))!;
    g().selectLine(wrong.id);
    await g().submitLine();
    expect(g().status).toBe("round_result");
    expect(g().lastResult?.outcome).toBe("incorrect");
    expect(g().lives).toBe(2);
  });

  it("a wrong diagnosis fails the round", async () => {
    const full = byId(g().currentPublic()!.id);
    g().selectLine(full.bugLineIds[0]);
    await g().submitLine();
    expect(g().status).toBe("diagnosing");
    const wrong = full.diagnosisOptions.find((o) => !o.isCorrect)!;
    g().selectDiagnosis(wrong.id);
    await g().submitDiagnosis();
    expect(g().lastResult?.outcome).toBe("incorrect");
    expect(g().lives).toBe(2);
  });

  it("timeout resolves the round as a timeout", async () => {
    useGameStore.setState({ timeLeftSec: 1 });
    g().tick();
    await new Promise((r) => setTimeout(r, 0)); // let the async forfeit settle
    expect(g().status).toBe("round_result");
    expect(g().lastResult?.outcome).toBe("timeout");
  });
});
