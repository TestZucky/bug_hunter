import { COMBO } from "./constants";

/** Speed multiplier ~0.5–1.5 based on time remaining (TDD §11.7). */
export function speedMultiplier(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0.5;
  const frac = Math.max(0, Math.min(remainingMs / totalMs, 1));
  return 0.5 + frac;
}

export type Accuracy = "perfect" | "retry" | "hint" | "incorrect";

/** Accuracy multiplier (TDD §11.7). */
export function accuracyMultiplier(a: Accuracy): number {
  switch (a) {
    case "perfect":
      return 1.0;
    case "retry":
      return 0.7;
    case "hint":
      return 0.5;
    case "incorrect":
      return 0;
  }
}

/** Combo multiplier: 1 + min(streak × 0.1, 2), capped at 3x (TDD §11.7). */
export function comboMultiplier(correctStreak: number): number {
  return 1 + Math.min(correctStreak * COMBO.step, COMBO.maxBonus);
}

export interface ScoreInput {
  baseScore: number;
  accuracy: Accuracy;
  remainingMs: number;
  totalMs: number;
  /** Streak BEFORE this round is applied. */
  correctStreak: number;
}

export interface ScoreResult {
  score: number;
  speed: number;
  combo: number;
  accuracy: number;
}

export function computeRoundScore(input: ScoreInput): ScoreResult {
  const speed = speedMultiplier(input.remainingMs, input.totalMs);
  const combo = comboMultiplier(input.correctStreak);
  const acc = accuracyMultiplier(input.accuracy);
  const score = Math.round(input.baseScore * acc * speed * combo);
  return { score, speed, combo, accuracy: acc };
}

/** XP for a round. Base per difficulty + perfect-round bonus, unaffected by speed/combo. */
export function computeRoundXP(
  baseXP: number,
  accuracy: Accuracy,
  perfectBonus: number,
): number {
  if (accuracy === "incorrect") return 0;
  const factor = accuracy === "perfect" ? 1 : accuracy === "retry" ? 0.7 : 0.5;
  const bonus = accuracy === "perfect" ? perfectBonus : 0;
  return Math.round(baseXP * factor) + bonus;
}
