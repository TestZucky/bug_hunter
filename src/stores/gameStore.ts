"use client";

import { create } from "zustand";
import { HEALTH, XP_BONUS } from "@/lib/constants";
import {
  computeRoundScore,
  computeRoundXP,
  type Accuracy,
} from "@/lib/scoring";
import { gradeStep } from "@/services/gameApi";
import type { ProductionImpact, PublicChallenge } from "@/types/challenge";
import type {
  GameMode,
  GameStatus,
  GradeKind,
  GradeResult,
  RevealPayload,
  RoundOutcome,
  RoundRecord,
  SessionConfig,
  SessionSummaryData,
} from "@/types/game";

/** Bug types that trigger the heavier "security missed" health penalty. */
const SECURITY_BUGS = new Set([
  "sql_injection",
  "xss",
  "authentication_error",
  "authorization_error",
]);

// ─── Grader injection (default = server API; tests inject a local grader) ────

type Grader = (
  sessionId: string,
  roundIndex: number,
  kind: GradeKind,
  selectedId: string | null,
) => Promise<GradeResult>;

let grader: Grader = gradeStep;

/** Override the grader (tests use a local one built from seed data). */
export function setGrader(g: Grader | null): void {
  grader = g ?? gradeStep;
}

export interface RoundResultView {
  outcome: RoundOutcome;
  challengeId: string;
  bugLabel: string;
  explanation: string;
  productionImpact: ProductionImpact | null;
  scoreAwarded: number;
  xpAwarded: number;
  comboMultiplier: number;
  newCombo: number;
  healthDelta: number;
  accuracy: Accuracy;
  correctLineId: string;
  correctFixCode: string;
}

interface GameState {
  config: SessionConfig | null;
  sessionId: string;
  challenges: PublicChallenge[];
  roundIndex: number;
  status: GameStatus;

  // Per-round selections
  pendingLineId: string | null;
  pendingDiagnosisId: string | null;
  pendingFixId: string | null;
  retryUsed: boolean;
  hintUsed: boolean;
  grading: boolean; // a grade round-trip is in flight
  shake: number;
  wrongLineId: string | null;

  // Timer
  totalSec: number;
  timeLeftSec: number;

  // Session totals
  score: number;
  xp: number;
  combo: number;
  maxCombo: number;
  lives: number;
  systemHealth: number;
  correctRounds: number;
  rounds: RoundRecord[];
  gameOverReason: "lives" | "health" | null;
  lastResult: RoundResultView | null;

  // Derived
  currentPublic: () => PublicChallenge | null;
  totalRounds: () => number | null;

  // Actions
  startSession: (
    config: SessionConfig,
    sessionId: string,
    challenges: PublicChallenge[],
  ) => void;
  selectLine: (lineId: string) => void;
  submitLine: () => Promise<void>;
  selectDiagnosis: (id: string) => void;
  submitDiagnosis: () => Promise<void>;
  selectFix: (id: string) => void;
  submitFix: () => Promise<void>;
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

type Set = (partial: Partial<GameState>) => void;
type Get = () => GameState;

export const useGameStore = create<GameState>((set, get) => ({
  config: null,
  sessionId: "",
  challenges: [],
  roundIndex: 0,
  status: "loading",

  pendingLineId: null,
  pendingDiagnosisId: null,
  pendingFixId: null,
  retryUsed: false,
  hintUsed: false,
  grading: false,
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

  currentPublic: () => {
    const { challenges, roundIndex, config } = get();
    if (challenges.length === 0) return null;
    if (config?.mode === "production" || config?.totalRounds == null) {
      return challenges[roundIndex % challenges.length];
    }
    return challenges[roundIndex] ?? null;
  },

  totalRounds: () => get().config?.totalRounds ?? null,

  startSession: (config, sessionId, challenges) => {
    set({
      config,
      sessionId,
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

  submitLine: async () => {
    const s = get();
    if (s.status !== "line_selected" || !s.pendingLineId || s.grading) return;
    const c = s.currentPublic();
    if (!c) return;
    const res = await runGrade(set, get, "line", s.pendingLineId);
    if (!res) return; // network error — no penalty, let them retry
    if (get().status !== "line_selected") return; // timed out mid-grade
    if (res.correct) set({ status: "diagnosing", wrongLineId: null });
    else handleStageMiss(set, get, s.pendingLineId, res.reveal);
  },

  selectDiagnosis: (id) => {
    if (get().status !== "diagnosing") return;
    set({ pendingDiagnosisId: id });
  },

  submitDiagnosis: async () => {
    const s = get();
    if (s.status !== "diagnosing" || !s.pendingDiagnosisId || s.grading) return;
    const c = s.currentPublic();
    if (!c) return;
    const res = await runGrade(set, get, "diagnosis", s.pendingDiagnosisId);
    if (!res) return;
    if (get().status !== "diagnosing") return;
    if (res.correct) {
      if (s.config?.skipFix) resolveRound(set, get, "correct", res.reveal);
      else set({ status: "fixing" });
    } else {
      handleStageMiss(set, get, null, res.reveal);
    }
  },

  selectFix: (id) => {
    if (get().status !== "fixing") return;
    set({ pendingFixId: id });
  },

  submitFix: async () => {
    const s = get();
    if (s.status !== "fixing" || !s.pendingFixId || s.grading) return;
    const c = s.currentPublic();
    if (!c) return;
    const res = await runGrade(set, get, "fix", s.pendingFixId);
    if (!res) return;
    if (get().status !== "fixing") return;
    if (res.correct) resolveRound(set, get, "correct", res.reveal);
    else handleStageMiss(set, get, null, res.reveal);
  },

  useHint: () => {
    if (!ACTIVE.includes(get().status)) return;
    set({ hintUsed: true });
  },

  tick: () => {
    const s = get();
    if (!ACTIVE.includes(s.status) || s.grading) return;
    if (isPractice(s.config!.mode)) return;
    const next = s.timeLeftSec - 1;
    if (next <= 0) {
      set({ timeLeftSec: 0 });
      void forfeit(set, get);
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

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Wrap a grade call with the in-flight flag; returns null on error. */
async function runGrade(
  set: Set,
  get: Get,
  kind: GradeKind,
  selectedId: string | null,
): Promise<GradeResult | null> {
  const { sessionId, roundIndex } = get();
  set({ grading: true });
  try {
    return await grader(sessionId, roundIndex, kind, selectedId);
  } catch {
    return null;
  } finally {
    set({ grading: false });
  }
}

function beginRound(set: Set, get: Get) {
  const s = get();
  const c = s.currentPublic();
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
    grading: false,
    wrongLineId: null,
    totalSec: time,
    timeLeftSec: time,
    lastResult: null,
  });
}

async function forfeit(set: Set, get: Get) {
  const s = get();
  if (s.status === "round_result") return;
  const c = s.currentPublic();
  if (!c) return;
  const res = await runGrade(set, get, "forfeit", null);
  if (get().status === "round_result") return;
  resolveRound(set, get, "timeout", res?.reveal);
}

/** A wrong answer. First miss grants one retry (unless practice=unlimited or
 *  allowRetry:false = one-shot); a second miss fails the round. */
function handleStageMiss(
  set: Set,
  get: Get,
  wrongLineId: string | null,
  reveal: RevealPayload | undefined,
) {
  const s = get();
  const practice = isPractice(s.config!.mode);
  const shake = s.shake + 1;

  if (practice) {
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

  if (s.config!.allowRetry === false) {
    set({ shake, wrongLineId: wrongLineId ?? s.wrongLineId });
    resolveRound(set, get, "incorrect", reveal);
    return;
  }

  if (!s.retryUsed) {
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

  set({ shake, wrongLineId: wrongLineId ?? s.wrongLineId });
  resolveRound(set, get, "incorrect", reveal);
}

function resolveRound(
  set: Set,
  get: Get,
  outcome: RoundOutcome,
  reveal: RevealPayload | undefined,
) {
  const s = get();
  if (s.status === "round_result") return; // guard double-resolve
  const c = s.currentPublic();
  if (!c) return;
  const practice = isPractice(s.config!.mode);

  const accuracy: Accuracy =
    outcome === "correct"
      ? s.hintUsed
        ? "hint"
        : s.retryUsed
          ? "retry"
          : "perfect"
      : "incorrect";

  const totalMs = s.totalSec * 1000;
  const remainingMs = s.timeLeftSec * 1000;

  let scoreAwarded = 0;
  let xpAwarded = 0;
  let newCombo = s.combo;
  let comboMult = 1;
  let healthDelta = 0;

  if (outcome === "correct") {
    const r = computeRoundScore({
      baseScore: c.baseScore,
      accuracy,
      remainingMs,
      totalMs,
      correctStreak: s.combo,
    });
    scoreAwarded = r.score;
    comboMult = r.combo;
    const perfect = accuracy === "perfect";
    xpAwarded = computeRoundXP(
      c.xpReward,
      accuracy,
      perfect ? XP_BONUS.perfectRound : 0,
    );
    newCombo = s.combo + 1;
    if (!practice)
      healthDelta = HEALTH.correct + (perfect ? HEALTH.perfectRoundBonus : 0);
  } else {
    newCombo = 0;
    if (!practice) {
      if (outcome === "timeout") healthDelta = HEALTH.timeout;
      else if (SECURITY_BUGS.has(c.bugType))
        healthDelta = HEALTH.securityMissed;
      else healthDelta = HEALTH.incorrect;
    }
  }

  const systemHealth = Math.max(
    HEALTH.min,
    Math.min(HEALTH.max, s.systemHealth + healthDelta),
  );

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
    bugLabel: reveal?.bugLabel ?? "Bug",
    explanation: reveal?.explanation ?? "",
    productionImpact: reveal?.productionImpact ?? null,
    scoreAwarded,
    xpAwarded,
    comboMultiplier: comboMult,
    newCombo,
    healthDelta,
    accuracy,
    correctLineId: reveal?.correctLineId ?? "",
    correctFixCode: reveal?.correctFixCode ?? "",
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
