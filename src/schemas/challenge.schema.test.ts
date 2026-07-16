import { describe, expect, it } from "vitest";
import {
  challengeSchema,
  validateChallenges,
} from "@/schemas/challenge.schema";
import { FIXTURE_CHALLENGES } from "@/test/fixtures";

describe("challenge schema", () => {
  it("accepts valid challenges", () => {
    for (const c of FIXTURE_CHALLENGES) {
      expect(challengeSchema.safeParse(c).success).toBe(true);
    }
  });

  it("rejects a challenge with two correct diagnoses", () => {
    const bad = structuredClone(FIXTURE_CHALLENGES[0]);
    bad.diagnosisOptions = bad.diagnosisOptions.map((o) => ({
      ...o,
      isCorrect: true,
    }));
    expect(() => validateChallenges([bad])).toThrow();
  });

  it("rejects a challenge whose bug line does not exist", () => {
    const bad = structuredClone(FIXTURE_CHALLENGES[0]);
    bad.bugLineIds = ["l999"];
    expect(() => validateChallenges([bad])).toThrow();
  });
});
