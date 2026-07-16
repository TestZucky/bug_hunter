"use client";

import { useCallback, useEffect, useRef } from "react";
import { LIVES, MODE_ROUNDS } from "@/lib/constants";
import {
  buildClassicRun,
  selectChallenges,
  todayKey,
} from "@/services/challengeService";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import type { Challenge, Difficulty, Language } from "@/types/challenge";
import type { GameMode, SessionConfig } from "@/types/game";

export interface RunOptions {
  mode: GameMode;
  language: Language | "mixed";
  difficulty?: Difficulty | "adaptive";
  category?: string;
}

function buildQueue(opts: RunOptions, seen: string[]): { queue: Challenge[]; config: SessionConfig } {
  const { mode, language } = opts;

  if (mode === "daily") {
    const seed = todayKey();
    const queue = buildClassicRun("mixed", MODE_ROUNDS.daily ?? 5, seed);
    return {
      queue,
      config: {
        mode,
        language: "mixed",
        difficulty: "adaptive",
        totalRounds: queue.length,
        lives: LIVES.daily,
        seed,
      },
    };
  }

  if (mode === "production") {
    // Long laddered queue; the store loops through it endlessly.
    const queue = buildClassicRun(language, 30);
    return {
      queue,
      config: {
        mode,
        language,
        difficulty: "adaptive",
        totalRounds: null,
        lives: LIVES.production,
      },
    };
  }

  if (mode === "practice") {
    const difficulty =
      opts.difficulty && opts.difficulty !== "adaptive"
        ? opts.difficulty
        : undefined;
    const queue = selectChallenges({
      language,
      difficulty,
      category: (opts.category as never) ?? "any",
      count: 20,
      exclude: seen,
    });
    return {
      queue,
      config: {
        mode,
        language,
        difficulty: opts.difficulty ?? "adaptive",
        totalRounds: null,
        lives: LIVES.classic,
      },
    };
  }

  // Classic
  const total = MODE_ROUNDS.classic ?? 10;
  const queue = buildClassicRun(language, total);
  return {
    queue,
    config: {
      mode,
      language,
      difficulty: "adaptive",
      totalRounds: Math.min(total, queue.length),
      lives: LIVES.classic,
    },
  };
}

/**
 * Bootstraps a game session for the given options and renders children
 * (the GameShell) once the store is primed. `replay` rebuilds a fresh run.
 */
export function useGameRunner(opts: RunOptions) {
  const startSession = useGameStore((s) => s.startSession);
  const seenIds = useUserStore((s) => s.seenChallengeIds);
  const seenRef = useRef(seenIds);
  seenRef.current = seenIds;
  const started = useRef(false);

  const start = useCallback(() => {
    const { queue, config } = buildQueue(opts, seenRef.current);
    startSession(config, queue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.mode, opts.language, opts.difficulty, opts.category, startSession]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  return { replay: start };
}
