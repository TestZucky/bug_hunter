import { beforeEach, describe, expect, it } from "vitest";
import { buildClassicRun } from "@/services/challengeService";
import { useGameStore } from "@/stores/gameStore";
import type { SessionConfig } from "@/types/game";

const g = () => useGameStore.getState();

const classic: SessionConfig = {
  mode: "classic",
  language: "javascript",
  difficulty: "adaptive",
  totalRounds: 10,
  lives: 3,
};

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

function solveCorrect() {
  const c = g().currentChallenge()!;
  g().selectLine(c.bugLineIds[0]);
  g().submitLine();
  const cd = c.diagnosisOptions.find((o) => o.isCorrect)!;
  g().selectDiagnosis(cd.id);
  g().submitDiagnosis();
  const cf = c.fixOptions.find((o) => o.isCorrect)!;
  g().selectFix(cf.id);
  g().submitFix();
}

describe("gameStore state machine", () => {
  beforeEach(() => {
    g().startSession(classic, buildClassicRun("javascript", 10));
  });

  it("starts a session in the inspecting state", () => {
    expect(g().status).toBe("inspecting");
  });

  it("plays a full correct round and awards score + combo", () => {
    solveCorrect();
    expect(g().status).toBe("round_result");
    expect(g().lastResult?.outcome).toBe("correct");
    expect(g().score).toBeGreaterThan(0);
    expect(g().combo).toBe(1);
  });

  it("grants one retry, then fails the round and loses a life", () => {
    const c = g().currentChallenge()!;
    const wrong = c.code.find(
      (l) => !c.bugLineIds.includes(l.id) && l.content.trim() !== "",
    )!;
    g().selectLine(wrong.id);
    g().submitLine();
    expect(g().status).toBe("inspecting");
    expect(g().lives).toBe(3);

    g().selectLine(wrong.id);
    g().submitLine();
    expect(g().lastResult?.outcome).toBe("incorrect");
    expect(g().lives).toBe(2);
    expect(g().combo).toBe(0);
  });

  it("simple mode: skips the fix stage and is one-shot", () => {
    g().startSession(simple, buildClassicRun("javascript", 40));
    const c = g().currentChallenge()!;
    g().selectLine(c.bugLineIds[0]);
    g().submitLine();
    expect(g().status).toBe("diagnosing");
    const cd = c.diagnosisOptions.find((o) => o.isCorrect)!;
    g().selectDiagnosis(cd.id);
    g().submitDiagnosis();
    expect(g().status).toBe("round_result");
    expect(g().lastResult?.outcome).toBe("correct");
  });

  it("timeout resolves the round as a timeout", () => {
    g().startSession(simple, buildClassicRun("javascript", 40));
    useGameStore.setState({ timeLeftSec: 1 });
    g().tick();
    expect(g().status).toBe("round_result");
    expect(g().lastResult?.outcome).toBe("timeout");
  });
});
