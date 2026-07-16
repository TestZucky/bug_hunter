import type { Difficulty } from "@/types/challenge";
import type { GameMode } from "@/types/game";

/** Per-difficulty timer, base score, and XP (TDD §11.4, §11.7, §11.8). */
export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { timeSeconds: number; baseScore: number; xpReward: number; label: string }
> = {
  easy: { timeSeconds: 20, baseScore: 100, xpReward: 20, label: "Easy" },
  medium: { timeSeconds: 15, baseScore: 200, xpReward: 35, label: "Medium" },
  hard: { timeSeconds: 10, baseScore: 350, xpReward: 60, label: "Hard" },
};

/** Difficulty display colors, matching the Figma palette. */
export const DIFFICULTY_COLORS: Record<
  Difficulty,
  { color: string; bg: string }
> = {
  easy: { color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  hard: { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
};

/** System-health deltas (TDD §11.6). */
export const HEALTH = {
  start: 100,
  correct: 3,
  perfectRoundBonus: 5,
  incorrect: -15,
  timeout: -20,
  securityMissed: -25,
  max: 100,
  min: 0,
};

export const LIVES = {
  classic: 3,
  production: 1, // production mode ends on health, lives is effectively unused
  daily: 3,
  practice: Infinity,
};

/** Round counts per mode. null = endless. */
export const MODE_ROUNDS: Record<GameMode, number | null> = {
  classic: 10,
  production: null,
  daily: 5,
  practice: null,
};

export const MODE_META: Record<
  GameMode,
  { name: string; tagline: string; accent: string; icon: string }
> = {
  classic: {
    name: "Classic",
    tagline: "10 rounds. 3 lives. Climb the difficulty.",
    accent: "#6366f1",
    icon: "swords",
  },
  production: {
    name: "Production Emergency",
    tagline: "Endless. Keep production alive as long as you can.",
    accent: "#ef4444",
    icon: "activity",
  },
  daily: {
    name: "Daily Challenge",
    tagline: "Same set for everyone. One run. Bonus XP.",
    accent: "#22d3ee",
    icon: "calendar",
  },
  practice: {
    name: "Practice",
    tagline: "No timer pressure. Pick a language and drill.",
    accent: "#4ade80",
    icon: "code",
  },
};

/** XP bonuses (TDD §11.8). */
export const XP_BONUS = {
  perfectRound: 10,
  dailyCompleted: 100,
  firstSessionOfDay: 25,
};

/** Combo cap and multiplier ceiling (TDD §11.7). */
export const COMBO = {
  step: 0.1,
  maxBonus: 2, // multiplier maxes at 1 + 2 = 3x
};

export const DAILY_ROUND_COUNT = 5;
