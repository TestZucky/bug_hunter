import { describe, expect, it } from "vitest";
import { buildRunFrom, toPublicChallenge } from "@/services/challengeService";
import { FIXTURE_CHALLENGES } from "@/test/fixtures";

describe("challengeService", () => {
  it("public projection strips all answer keys", () => {
    const json = JSON.stringify(toPublicChallenge(FIXTURE_CHALLENGES[0]));
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("bugLineIds");
    expect(json).not.toContain("explanation");
    expect(json).not.toContain("productionImpact");
  });

  it("public projection keeps every option (by id)", () => {
    const c = FIXTURE_CHALLENGES[0];
    const pub = toPublicChallenge(c);
    expect(pub.diagnosisOptions.length).toBe(c.diagnosisOptions.length);
    expect(pub.fixOptions.length).toBe(c.fixOptions.length);
    expect(new Set(pub.diagnosisOptions.map((o) => o.id))).toEqual(
      new Set(c.diagnosisOptions.map((o) => o.id)),
    );
  });

  it("public projection is deterministic per challenge", () => {
    expect(JSON.stringify(toPublicChallenge(FIXTURE_CHALLENGES[0]))).toBe(
      JSON.stringify(toPublicChallenge(FIXTURE_CHALLENGES[0])),
    );
  });

  it("buildRunFrom respects count and language", () => {
    const run = buildRunFrom(FIXTURE_CHALLENGES, "javascript", 2);
    expect(run).toHaveLength(2);
    expect(run.every((c) => c.language === "javascript")).toBe(true);
  });
});
