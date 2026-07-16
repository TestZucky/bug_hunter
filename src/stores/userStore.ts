"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getRankProgress, type Rank } from "@/lib/ranks";
import { todayKey } from "@/services/challengeService";
import type { GameMode, SessionSummaryData } from "@/types/game";

interface CategoryStat {
  correct: number;
  total: number;
}

interface UserState {
  displayName: string;
  totalXp: number;
  dailyStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  lastDailyCompleted: string | null;
  gamesPlayed: number;
  totalCorrect: number;
  totalRounds: number;
  maxCombo: number;
  bestScores: Partial<Record<GameMode, number>>;
  categoryStats: Record<string, CategoryStat>;
  seenChallengeIds: string[];

  setDisplayName: (name: string) => void;
  recordSession: (summary: SessionSummaryData) => SessionOutcome;
  hasCompletedDailyToday: () => boolean;
  resetProgress: () => void;
}

export interface SessionOutcome {
  xpBefore: number;
  xpAfter: number;
  rankBefore: Rank;
  rankAfter: Rank;
  rankedUp: boolean;
  newStreak: number;
  isNewBest: boolean;
}

const initial = {
  displayName: "you",
  totalXp: 0,
  dailyStreak: 0,
  longestStreak: 0,
  lastActivityDate: null as string | null,
  lastDailyCompleted: null as string | null,
  gamesPlayed: 0,
  totalCorrect: 0,
  totalRounds: 0,
  maxCombo: 0,
  bestScores: {} as Partial<Record<GameMode, number>>,
  categoryStats: {} as Record<string, CategoryStat>,
  seenChallengeIds: [] as string[],
};

/** Difference in whole days between two YYYY-MM-DD keys. */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initial,

      setDisplayName: (name) =>
        set({ displayName: name.trim().slice(0, 24) || "you" }),

      hasCompletedDailyToday: () => get().lastDailyCompleted === todayKey(),

      recordSession: (summary) => {
        const state = get();
        const xpBefore = state.totalXp;
        const xpAfter = xpBefore + summary.xpEarned;
        const rankBefore = getRankProgress(xpBefore).rank;
        const rankAfter = getRankProgress(xpAfter).rank;

        // Streak: qualifies if at least one correct round this session.
        const today = todayKey();
        let streak = state.dailyStreak;
        if (summary.correctRounds > 0) {
          if (!state.lastActivityDate) {
            streak = 1;
          } else {
            const gap = daysBetween(state.lastActivityDate, today);
            if (gap === 0) {
              streak = state.dailyStreak || 1;
            } else if (gap === 1) {
              streak = state.dailyStreak + 1;
            } else {
              streak = 1;
            }
          }
        }

        // Per-category accuracy tracking (for recommendations / adaptive).
        const categoryStats = { ...state.categoryStats };
        // Best score per mode.
        const prevBest = state.bestScores[summary.mode] ?? 0;
        const isNewBest = summary.finalScore > prevBest;

        const seen = new Set(state.seenChallengeIds);
        for (const r of summary.rounds) seen.add(r.challengeId);

        set({
          totalXp: xpAfter,
          dailyStreak: streak,
          longestStreak: Math.max(state.longestStreak, streak),
          lastActivityDate:
            summary.correctRounds > 0 ? today : state.lastActivityDate,
          gamesPlayed: state.gamesPlayed + 1,
          totalCorrect: state.totalCorrect + summary.correctRounds,
          totalRounds: state.totalRounds + summary.totalRounds,
          maxCombo: Math.max(state.maxCombo, summary.maxCombo),
          bestScores: {
            ...state.bestScores,
            [summary.mode]: Math.max(prevBest, summary.finalScore),
          },
          categoryStats,
          seenChallengeIds: [...seen].slice(-200),
          lastDailyCompleted:
            summary.mode === "daily" ? today : state.lastDailyCompleted,
        });

        return {
          xpBefore,
          xpAfter,
          rankBefore,
          rankAfter,
          rankedUp: rankAfter.name !== rankBefore.name,
          newStreak: streak,
          isNewBest,
        };
      },

      resetProgress: () => set({ ...initial }),
    }),
    { name: "bughunter.user" },
  ),
);
