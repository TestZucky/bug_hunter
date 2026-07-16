import { describe, expect, it } from "vitest";
import {
  accuracyMultiplier,
  comboMultiplier,
  computeRoundScore,
  computeRoundXP,
  speedMultiplier,
} from "@/lib/scoring";

describe("scoring", () => {
  it("combo multiplier: 1x base, caps at 3x", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(50)).toBe(3);
  });

  it("speed multiplier ranges 0.5..1.5", () => {
    expect(speedMultiplier(0, 100)).toBeCloseTo(0.5);
    expect(speedMultiplier(50, 100)).toBeCloseTo(1.0);
    expect(speedMultiplier(100, 100)).toBeCloseTo(1.5);
  });

  it("accuracy multipliers match the TDD table", () => {
    expect(accuracyMultiplier("perfect")).toBe(1);
    expect(accuracyMultiplier("retry")).toBe(0.7);
    expect(accuracyMultiplier("hint")).toBe(0.5);
    expect(accuracyMultiplier("incorrect")).toBe(0);
  });

  it("faster answers score higher than slower ones", () => {
    const base = {
      baseScore: 100,
      accuracy: "perfect" as const,
      totalMs: 20000,
      correctStreak: 0,
    };
    const fast = computeRoundScore({ ...base, remainingMs: 20000 });
    const slow = computeRoundScore({ ...base, remainingMs: 2000 });
    expect(fast.score).toBeGreaterThan(slow.score);
  });

  it("perfect scores more than a retry", () => {
    const base = {
      baseScore: 100,
      remainingMs: 10000,
      totalMs: 20000,
      correctStreak: 0,
    };
    expect(
      computeRoundScore({ ...base, accuracy: "perfect" }).score,
    ).toBeGreaterThan(computeRoundScore({ ...base, accuracy: "retry" }).score);
  });

  it("xp: none for incorrect, bonus for perfect", () => {
    expect(computeRoundXP(20, "incorrect", 10)).toBe(0);
    expect(computeRoundXP(20, "perfect", 10)).toBe(30);
    expect(computeRoundXP(20, "retry", 10)).toBe(14);
  });
});
