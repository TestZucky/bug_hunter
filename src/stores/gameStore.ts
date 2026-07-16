"use client";

import { create } from "zustand";
import { HEALTH, XP_BONUS } from "@/lib/constants";
import {
  accuracyMultiplier,
  computeRoundScore,
  computeRoundXP,
  type Accuracy,
} from "@/lib/scoring";
import {
  correctDiagnosis,
  correctFix,
  isBugLineCorrect,
  isDiagnosisCorrect,
  isFixCorrect,
  toPublicChallenge,
} from "@/services/challengeService";
import type { Challenge, PublicChallenge } from "@/types/challenge";
import type {
  GameMode,
  GameStatus,
  RoundOutcome,
  RoundRecord,
  SessionConfig,
  SessionSummaryData,
} from "@/types/game";

/** Categories/bug types that trigger the heavier "security missed" penalty. */
const SECURITY_BUGS = new Set([
  "sql_injection",
  "xss",
  "authentication_error",
  "authorization_error",
]);

export interface RoundResultView {
  outcome: RoundOutcome;
  challengeId: string;
  bugLabel: string;
  explanation: string;
  scoreAwarded: number;
  xpAwarded: number;
  comboMultiplier: number;
  newCombo: number;
  healthDelta: number;
  accuracy: Accuracy;
  correctLineId: string;
  correctDiagnosisId: string;
  correctFixId: string;
  correctFixCode: string;
}

interface GameState {
  // Session config + data
  config: SessionConfig | null;
  challenges: Challenge[];
  roundIndex: number;

  // Machine
  status: GameStatus;

  // Per-round selections
  pendingLineId: string | null;
  pendingDiagnosisId: string | null;
  pendingFixId: string | null;
  retryUsed: boolean;
  hintUsed: boolean;
  shake: number; // increments to retrigger shake animation
  wrongLineId: string | null; // last wrong line, for reveal

  // Timer
  totalSec: number;
  timeLeftSec: number;

  // Session totals
  score: number;
  xp: number;
  combo: number; // current correct streak
  maxCombo: number;
  lives: number;
  systemHealth: number;
  correctRounds: number;
  rounds: RoundRecord[];
  gameOverReason: "lives" | "health" | null;

  // Result of the round just finished
  lastResult: RoundResultView | null;

  // Derived helpers
  currentChallenge: () => Challenge | null;
  currentPublic: () => PublicChallenge | null;
  totalRounds: () => number | null;

  // Actions
  startSession: (config: SessionConfig, challenges: Challenge[]) => void;
  selectLine: (lineId: string) => void;
  submitLine: () => void;
  selectDiagnosis: (id: string) => void;
  submitDiagnosis: () => void;
  selectFix: (id: string) => void;
  submitFix: () => void;
  useHint: () => void;
  tick: () => void;
  nextRound: () => void;
  pause: () => void;
  resume: () => void;
  buildSummary: () => SessionSummaryData;
}

const ACTIVE: GameStatus[] = [
  "inspecting",
  "line_selected",
  "diagnosing",
  "fixing",
];

function isPractice(mode: GameMode) {
  return mode === "practice";
}

export const useGameStore = create<GameState>((set, get) => ({
  config: null,
  challenges: [],
  roundIndex: 0,
  status: "loading",

  pendingLineId: null,
  pendingDiagnosisId: null,
  pendingFixId: null,
  retryUsed: false,
  hintUsed: false,
  shake: 0,
  wrongLineId: null,

  totalSec: 20,
  timeLeftSec: 20,

  score: 0,
  xp: 0,
  combo: 0,
  maxCombo: 0,
  lives: 3,
  systemHealth: HEALTH.start,
  correctRounds: 0,
  rounds: [],
  gameOverReason: null,
  lastResult: null,

  currentChallenge: () => {
    const { challenges, roundIndex, config } = get();
    if (challenges.length === 0) return null;
    if (config?.mode === "production" || config?.totalRounds == null) {
      return challenges[roundIndex % challenges.length];
    }
    return challenges[roundIndex] ?? null;
  },

  currentPublic: () => {
    const c = get().currentChallenge();
    return c ? toPublicChallenge(c) : null;
  },

  totalRounds: () => get().config?.totalRounds ?? null,

  startSession: (config, challenges) => {
    set({
      config,
      challenges,
      roundIndex: 0,
      status: "loading",
      score: 0,
      xp: 0,
      combo: 0,
      maxCombo: 0,
      lives: config.lives,
      systemHealth: HEALTH.start,
      correctRounds: 0,
      rounds: [],
      gameOverReason: null,
      lastResult: null,
    });
    beginRound(set, get);
  },

  selectLine: (lineId) => {
    if (!ACTIVE.includes(get().status)) return;
    set({ pendingLineId: lineId, status: "line_selected" });
  },

  submitLine: () => {
    const s = get();
    if (s.status !== "line_selected" || !s.pendingLineId) return;
    const c = s.currentChallenge();
    if (!c) return;
    if (isBugLineCorrect(c, s.pendingLineId)) {
      set({ status: "diagnosing", wrongLineId: null });
    } else {
      handleStageMiss(set, get, s.pendingLineId);
    }
  },

  selectDiagnosis: (id) => {
    if (get().status !== "diagnosing") return;
    set({ pendingDiagnosisId: id });
  },

  submitDiagnosis: () => {
    const s = get();
    if (s.status !== "diagnosing" || !s.pendingDiagnosisId) return;
    const c = s.currentChallenge();
    if (!c) return;
    if (isDiagnosisCorrect(c, s.pendingDiagnosisId)) {
      if (s.config?.skipFix) resolveRound(set, get, "correct");
      else set({ status: "fixing" });
    } else {
      handleStageMiss(set, get, null);
    }
  },

  selectFix: (id) => {
    if (get().status !== "fixing") return;
    set({ pendingFixId: id });
  },

  submitFix: () => {
    const s = get();
    if (s.status !== "fixing" || !s.pendingFixId) return;
    const c = s.currentChallenge();
    if (!c) return;
    if (isFixCorrect(c, s.pendingFixId)) {
      resolveRound(set, get, "correct");
    } else {
      handleStageMiss(set, get, null);
    }
  },

  useHint: () => {
    if (!ACTIVE.includes(get().status)) return;
    set({ hintUsed: true });
  },

  tick: () => {
    const s = get();
    if (!ACTIVE.includes(s.status)) return;
    if (isPractice(s.config!.mode)) return; // no timer in practice
    const next = s.timeLeftSec - 1;
    if (next <= 0) {
      set({ timeLeftSec: 0 });
      resolveRound(set, get, "timeout");
    } else {
      set({ timeLeftSec: next });
    }
  },

  nextRound: () => {
    const s = get();
    if (s.status !== "round_result") return;
    if (s.gameOverReason) {
      set({ status: "session_complete" });
      return;
    }
    // Classic/daily: stop when rounds are exhausted.
    const total = s.config?.totalRounds;
    if (total != null && s.roundIndex + 1 >= total) {
      set({ status: "session_complete" });
      return;
    }
    set({ roundIndex: s.roundIndex + 1 });
    beginRound(set, get);
  },

  pause: () => {
    if (ACTIVE.includes(get().status)) set({ status: "paused" });
  },
  resume: () => {
    if (get().status === "paused") set({ status: "inspecting" });
  },

  buildSummary: () => {
    const s = get();
    const total = s.rounds.length;
    const accuracy =
      total > 0 ? Math.round((s.correctRounds / total) * 100) : 0;
    return {
      mode: s.config!.mode,
      finalScore: s.score,
      xpEarned: s.xp,
      accuracy,
      maxCombo: s.maxCombo,
      correctRounds: s.correctRounds,
      totalRounds: total,
      systemHealth: s.systemHealth,
      rounds: s.rounds,
    };
  },
}));

// ─── Internal transition helpers ───────────────────────────────────────────

function beginRound(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
) {
  const s = get();
  const c = s.currentChallenge();
  if (!c) {
    set({ status: "session_complete" });
    return;
  }
  const time =
    s.config!.roundSeconds ??
    (isPractice(s.config!.mode) ? 999 : c.estimatedTimeSeconds);
  set({
    status: "inspecting",
    pendingLineId: null,
    pendingDiagnosisId: null,
    pendingFixId: null,
    retryUsed: false,
    hintUsed: false,
    wrongLineId: null,
    totalSec: time,
    timeLeftSec: time,
    lastResult: null,
  });
}

/**
 * A wrong answer at any stage. First miss in a round grants one retry
 * (except practice = unlimited, no penalty). A second miss fails the round.
 */
function handleStageMiss(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  wrongLineId: string | null,
) {
  const s = get();
  const practice = isPractice(s.config!.mode);
  const shake = s.shake + 1;

  if (practice) {
    // Unlimited retries, no penalty — clear the pending wrong selection.
    set({
      shake,
      retryUsed: true,
      pendingLineId: s.status === "line_selected" ? null : s.pendingLineId,
      pendingDiagnosisId:
        s.status === "diagnosing" ? null : s.pendingDiagnosisId,
      pendingFixId: s.status === "fixing" ? null : s.pendingFixId,
      status: s.status === "line_selected" ? "inspecting" : s.status,
    });
    return;
  }

  // Simple/one-shot mode: any miss fails the round immediately.
  if (s.config!.allowRetry === false) {
    set({ shake, wrongLineId: wrongLineId ?? s.wrongLineId });
    resolveRound(set, get, "incorrect");
    return;
  }

  if (!s.retryUsed) {
    // Grant one retry; downgrade accuracy but stay on this stage.
    set({
      retryUsed: true,
      shake,
      wrongLineId: wrongLineId ?? s.wrongLineId,
      pendingLineId: s.status === "line_selected" ? null : s.pendingLineId,
      pendingDiagnosisId:
        s.status === "diagnosing" ? null : s.pendingDiagnosisId,
      pendingFixId: s.status === "fixing" ? null : s.pendingFixId,
      status: s.status === "line_selected" ? "inspecting" : s.status,
    });
    return;
  }

  // Second miss — the round fails.
  set({ shake, wrongLineId: wrongLineId ?? s.wrongLineId });
  resolveRound(set, get, "incorrect");
}

function resolveRound(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  outcome: RoundOutcome,
) {
  const s = get();
  const c = s.currentChallenge();
  if (!c) return;
  const practice = isPractice(s.config!.mode);

  const cFix = correctFix(c)!;
  const cDiag = correctDiagnosis(c)!;

  let accuracy: Accuracy;
  if (outcome === "correct") {
    accuracy = s.hintUsed ? "hint" : s.retryUsed ? "retry" : "perfect";
  } else {
    accuracy = "incorrect";
  }

  const totalMs = s.totalSec * 1000;
  const remainingMs = s.timeLeftSec * 1000;

  let scoreAwarded = 0;
  let xpAwarded = 0;
  let newCombo = s.combo;
  let comboMult = 1;
  let healthDelta = 0;

  if (outcome === "correct") {
    const scoreResult = computeRoundScore({
      baseScore: c.baseScore,
      accuracy,
      remainingMs,
      totalMs,
      correctStreak: s.combo,
    });
    scoreAwarded = scoreResult.score;
    comboMult = scoreResult.combo;
    const perfect = accuracy === "perfect";
    xpAwarded = computeRoundXP(
      c.xpReward,
      accuracy,
      perfect ? XP_BONUS.perfectRound : 0,
    );
    newCombo = s.combo + 1;
    if (!practice) {
      healthDelta = HEALTH.correct + (perfect ? HEALTH.perfectRoundBonus : 0);
    }
  } else {
    newCombo = 0;
    if (!practice) {
      if (outcome === "timeout") healthDelta = HEALTH.timeout;
      else if (SECURITY_BUGS.has(c.bugType)) healthDelta = HEALTH.securityMissed;
      else healthDelta = HEALTH.incorrect;
    }
  }

  // Apply health within bounds.
  const systemHealth = Math.max(
    HEALTH.min,
    Math.min(HEALTH.max, s.systemHealth + healthDelta),
  );

  // Lives: lose at most one per failed round (classic/daily). Production
  // ignores lives and ends on health. Practice never loses.
  let lives = s.lives;
  let gameOverReason: GameState["gameOverReason"] = null;
  if (outcome !== "correct" && !practice) {
    if (s.config!.mode === "production") {
      if (systemHealth <= HEALTH.min) gameOverReason = "health";
    } else {
      lives = Math.max(0, s.lives - 1);
      if (lives <= 0) gameOverReason = "lives";
    }
  }
  // Production can also die on a bad-enough correct? No — only failures hurt.
  if (s.config!.mode === "production" && systemHealth <= HEALTH.min) {
    gameOverReason = "health";
  }

  const record: RoundRecord = {
    challengeId: c.id,
    roundNumber: s.roundIndex + 1,
    selectedLineId: s.pendingLineId,
    selectedDiagnosisId: s.pendingDiagnosisId,
    selectedFixId: s.pendingFixId,
    lineCorrect: outcome === "correct",
    diagnosisCorrect: outcome === "correct",
    fixCorrect: outcome === "correct",
    timeTakenMs: Math.max(0, totalMs - remainingMs),
    scoreAwarded,
    xpAwarded,
    outcome,
  };

  const result: RoundResultView = {
    outcome,
    challengeId: c.id,
    bugLabel: bugLabel(c),
    explanation: c.explanation,
    scoreAwarded,
    xpAwarded,
    comboMultiplier: comboMult,
    newCombo,
    healthDelta,
    accuracy,
    correctLineId: c.bugLineIds[0],
    correctDiagnosisId: cDiag.id,
    correctFixId: cFix.id,
    correctFixCode: cFix.code,
  };

  set({
    status: "round_result",
    score: s.score + scoreAwarded,
    xp: s.xp + xpAwarded,
    combo: newCombo,
    maxCombo: Math.max(s.maxCombo, newCombo),
    lives,
    systemHealth,
    correctRounds: s.correctRounds + (outcome === "correct" ? 1 : 0),
    rounds: [...s.rounds, record],
    gameOverReason,
    lastResult: result,
  });
}

/** Human-readable bug label from the bug type. */
export function bugLabel(c: Challenge): string {
  const map: Record<string, string> = {
    off_by_one: "Off-by-One Error",
    null_reference: "Null Reference",
    undefined_access: "Undefined Access",
    missing_await: "Missing Await",
    unhandled_promise: "Unhandled Rejection",
    race_condition: "Race Condition",
    sql_injection: "SQL Injection",
    xss: "XSS Vulnerability",
    authorization_error: "Broken Authorization",
    authentication_error: "Auth Vulnerability",
    memory_leak: "Memory Leak",
    resource_leak: "Resource Leak",
    performance_issue: "Performance Issue",
    incorrect_mutation: "Incorrect Mutation",
    wrong_condition: "Wrong Condition",
    wrong_status_code: "Wrong Status Code",
    loose_equality: "Loose Equality",
    type_mismatch: "Type Mismatch",
    missing_return: "Missing Return",
    stale_state: "Stale State",
    infinite_loop: "Infinite Loop",
    syntax_error: "Syntax Error",
  };
  return map[c.bugType] ?? "Bug";
}

export { accuracyMultiplier };
