import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/content/challenges";
import {
  challengeSchema,
  validateChallenges,
} from "@/schemas/challenge.schema";

describe("challenge content", () => {
  it("ships a meaningful, multi-language bank", () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(25);
    expect(CHALLENGES.some((c) => c.language === "javascript")).toBe(true);
    expect(CHALLENGES.some((c) => c.language === "python")).toBe(true);
  });

  it("every shipped challenge is schema-valid", () => {
    for (const c of CHALLENGES) {
      expect(challengeSchema.safeParse(c).success).toBe(true);
    }
  });

  it("challenge ids are unique", () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects a challenge with two correct diagnoses", () => {
    const bad = structuredClone(CHALLENGES[0]);
    bad.diagnosisOptions = bad.diagnosisOptions.map((o) => ({
      ...o,
      isCorrect: true,
    }));
    expect(() => validateChallenges([bad])).toThrow();
  });

  it("rejects a challenge whose bug line does not exist", () => {
    const bad = structuredClone(CHALLENGES[0]);
    bad.bugLineIds = ["l999"];
    expect(() => validateChallenges([bad])).toThrow();
  });
});
