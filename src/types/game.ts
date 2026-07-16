import type { Difficulty, Language } from "./challenge";

export type GameMode = "classic" | "production" | "daily" | "practice";

/** Explicit state machine states from the TDD (§13). */
export type GameStatus =
  | "loading"
  | "round_intro"
  | "inspecting"
  | "line_selected"
  | "diagnosing"
  | "fixing"
  | "round_result"
  | "session_complete"
  | "paused";

export type RoundOutcome = "correct" | "incorrect" | "timeout";

export interface RoundRecord {
  challengeId: string;
  roundNumber: number;
  selectedLineId: string | null;
  selectedDiagnosisId: string | null;
  selectedFixId: string | null;
  lineCorrect: boolean;
  diagnosisCorrect: boolean;
  fixCorrect: boolean;
  timeTakenMs: number;
  scoreAwarded: number;
  xpAwarded: number;
  outcome: RoundOutcome;
}

export interface SessionConfig {
  mode: GameMode;
  language: Language | "mixed";
  difficulty: Difficulty | "adaptive";
  /** null = endless. */
  totalRounds: number | null;
  lives: number;
  /** Daily mode uses a deterministic seed. */
  seed?: string;
  /** Simple mode: end the round after a correct diagnosis (no Fix stage). */
  skipFix?: boolean;
  /** Fixed seconds per round, overriding the per-difficulty timer. */
  roundSeconds?: number;
  /** When false, a single wrong tap/answer fails the round immediately. */
  allowRetry?: boolean;
}

export interface SessionSummaryData {
  mode: GameMode;
  finalScore: number;
  xpEarned: number;
  accuracy: number;
  maxCombo: number;
  correctRounds: number;
  totalRounds: number;
  systemHealth: number;
  rounds: RoundRecord[];
}
