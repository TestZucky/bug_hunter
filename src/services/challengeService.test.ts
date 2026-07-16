import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/content/challenges";
import {
  buildClassicRun,
  selectChallenges,
  toPublicChallenge,
} from "@/services/challengeService";

describe("challengeService", () => {
  it("public projection strips all answer keys", () => {
    const json = JSON.stringify(toPublicChallenge(CHALLENGES[0]));
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("bugLineIds");
    expect(json).not.toContain("explanation");
    expect(json).not.toContain("productionImpact");
  });

  it("public projection keeps every option (by id)", () => {
    const c = CHALLENGES[0];
    const pub = toPublicChallenge(c);
    expect(pub.diagnosisOptions.length).toBe(c.diagnosisOptions.length);
    expect(pub.fixOptions.length).toBe(c.fixOptions.length);
    expect(new Set(pub.diagnosisOptions.map((o) => o.id))).toEqual(
      new Set(c.diagnosisOptions.map((o) => o.id)),
    );
  });

  it("public projection is deterministic per challenge", () => {
    expect(JSON.stringify(toPublicChallenge(CHALLENGES[0]))).toBe(
      JSON.stringify(toPublicChallenge(CHALLENGES[0])),
    );
  });

  it("selectChallenges respects count and language", () => {
    const picks = selectChallenges({ language: "python", count: 5 });
    expect(picks.length).toBe(5);
    expect(picks.every((c) => c.language === "python")).toBe(true);
  });

  it("buildClassicRun returns the requested length", () => {
    expect(buildClassicRun("javascript", 10)).toHaveLength(10);
  });
});
