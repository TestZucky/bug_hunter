"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Heart,
  RotateCcw,
  Star,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSound } from "@/hooks/useSound";
import { useTimer } from "@/hooks/useTimer";
import { TOKEN_COLORS, tokenize } from "@/lib/syntax";
import { fetchSessionChallenges } from "@/services/gameApi";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore, type SessionOutcome } from "@/stores/userStore";
import type { Language } from "@/types/challenge";
import { Confetti } from "./Confetti";

const ROUND_SECONDS = 60;

export function SimpleGame({ language }: { language: Language | "mixed" }) {
  useTimer();
  const { play, vibrate } = useSound();

  const status = useGameStore((s) => s.status);
  const timeLeft = useGameStore((s) => s.timeLeftSec);
  const score = useGameStore((s) => s.score);
  const lives = useGameStore((s) => s.lives);
  const combo = useGameStore((s) => s.combo);
  const pendingLineId = useGameStore((s) => s.pendingLineId);
  const wrongLineId = useGameStore((s) => s.wrongLineId);
  const shake = useGameStore((s) => s.shake);
  const lastResult = useGameStore((s) => s.lastResult);
  const roundIndex = useGameStore((s) => s.roundIndex);
  const grading = useGameStore((s) => s.grading);

  const startSession = useGameStore((s) => s.startSession);
  const selectLine = useGameStore((s) => s.selectLine);
  const submitLine = useGameStore((s) => s.submitLine);
  const selectDiagnosis = useGameStore((s) => s.selectDiagnosis);
  const submitDiagnosis = useGameStore((s) => s.submitDiagnosis);
  const nextRound = useGameStore((s) => s.nextRound);

  const pub = useGameStore((s) => s.currentPublic)();

  const bestScore = useUserStore((s) => s.bestScores.classic ?? 0);
  const recordSession = useUserStore((s) => s.recordSession);
  const buildSummary = useGameStore((s) => s.buildSummary);

  const [confetti, setConfetti] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const started = useRef(false);
  const recorded = useRef(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);

  const start = useCallback(async () => {
    recorded.current = false;
    setOutcome(null);
    setLoadError(false);
    try {
      const challenges = await fetchSessionChallenges(language, 40);
      startSession(
        {
          mode: "classic",
          language,
          difficulty: "adaptive",
          totalRounds: null,
          lives: 3,
          skipFix: true,
          roundSeconds: ROUND_SECONDS,
          allowRetry: false,
        },
        challenges,
      );
    } catch {
      setLoadError(true);
    }
  }, [language, startSession]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  // Record final score once, on game over.
  useEffect(() => {
    if (status === "session_complete" && !recorded.current) {
      recorded.current = true;
      setOutcome(recordSession(buildSummary()));
    }
  }, [status, recordSession, buildSummary]);

  // Feedback sounds + confetti.
  const prevResult = useRef(lastResult);
  useEffect(() => {
    if (lastResult && lastResult !== prevResult.current) {
      if (lastResult.outcome === "correct") {
        play(lastResult.newCombo > 1 ? "combo" : "correct");
        vibrate([15, 30, 15]);
        setConfetti(true);
        setTimeout(() => setConfetti(false), 1300);
      } else {
        play("wrong");
        vibrate(140);
      }
    }
    prevResult.current = lastResult;
  }, [lastResult, play, vibrate]);

  const prevShake = useRef(shake);
  useEffect(() => {
    if (shake > prevShake.current) vibrate(80);
    prevShake.current = shake;
  }, [shake, vibrate]);

  // ── Tap handlers (single tap commits; grading is server-side) ─────
  function tapLine(id: string) {
    if (grading) return;
    if (status !== "inspecting" && status !== "line_selected") return;
    play("select");
    selectLine(id);
    void submitLine();
  }
  function tapOption(id: string) {
    if (grading) return;
    if (status !== "diagnosing") return;
    play("select");
    selectDiagnosis(id);
    void submitDiagnosis();
  }

  const timerPct = (timeLeft / ROUND_SECONDS) * 100;
  const timerColor =
    timerPct > 50 ? "#4ade80" : timerPct > 25 ? "#fbbf24" : "#ef4444";
  const showResult = status === "round_result";
  const revealBug = showResult ? lastResult?.correctLineId : null;

  // ── Game over ────────────────────────────────────────────────────
  if (status === "session_complete") {
    const summary = buildSummary();
    const isBest = summary.finalScore >= bestScore && summary.finalScore > 0;
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-3xl border border-border p-7 text-center"
          style={{ background: "#0d0d1c" }}
        >
          <div className="text-5xl mb-3">{isBest ? "🏆" : "💥"}</div>
          <h1 className="text-xl font-bold mb-1">
            {isBest ? "New best!" : "Game over"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {summary.correctRounds} bugs squashed
          </p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div
              className="rounded-2xl p-4 border border-border"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <div className="text-2xl font-bold tabular-nums">
                {summary.finalScore.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Score</div>
            </div>
            <div
              className="rounded-2xl p-4 border border-border"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <div className="text-2xl font-bold tabular-nums">
                {Math.max(bestScore, summary.finalScore).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Best</div>
            </div>
          </div>
          {outcome?.rankedUp && (
            <div
              className="mb-4 p-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "rgba(99,102,241,0.12)",
                color: outcome.rankAfter.color,
              }}
            >
              Ranked up to {outcome.rankAfter.name}!
            </div>
          )}
          <button
            onClick={() => void start()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm mb-2 transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, #6366f1, #7c3aed)",
              color: "#fff",
            }}
          >
            <RotateCcw className="w-4 h-4" /> Play again
          </button>
          <Link
            href="/"
            className="block w-full py-3 rounded-2xl font-semibold text-sm border border-border text-muted-foreground"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            Change language
          </Link>
        </motion.div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-3" aria-hidden>
          📡
        </div>
        <h1 className="text-lg font-bold mb-1">
          Couldn&apos;t load challenges
        </h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          The challenge server didn&apos;t respond. Check your connection and
          try again.
        </p>
        <button
          onClick={() => void start()}
          className="px-5 py-2.5 rounded-2xl font-semibold text-sm"
          style={{
            background: "linear-gradient(135deg, #6366f1, #7c3aed)",
            color: "#fff",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!pub) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col max-w-[520px] mx-auto w-full">
      {confetti && <Confetti />}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <Link
          href="/"
          aria-label="Quit"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <X className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4" style={{ color: "#fbbf24" }} />
          <span className="font-bold tabular-nums">
            {score.toLocaleString()}
          </span>
          {combo > 1 && (
            <span
              className="ml-1 flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(99,102,241,0.2)", color: "#a78bfa" }}
            >
              <Zap className="w-3 h-3" /> {combo}×
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              className="w-5 h-5"
              style={{
                color: i < lives ? "#ef4444" : "#1e293b",
                fill: i < lives ? "#ef4444" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Timer bar */}
      <div className="px-4 shrink-0">
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${timerPct}%`,
              background: timerColor,
              transition: "width 1s linear, background 0.3s",
            }}
          />
        </div>
      </div>

      {/* Prompt */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold">
            {status === "diagnosing"
              ? "What's wrong with this line?"
              : "Tap the buggy line"}
          </h1>
          <span className="text-xs text-muted-foreground font-mono">
            #{roundIndex + 1} · {pub.language === "python" ? "PY" : "JS"}
          </span>
        </div>
      </div>

      {/* Code card */}
      <div className="px-4 flex-1 min-h-0 flex flex-col">
        <motion.div
          key={`code-${shake}`}
          animate={shake > 0 ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border overflow-hidden flex flex-col min-h-0"
          style={{ background: "rgba(13,13,28,0.9)" }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex gap-1.5" aria-hidden>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#ef4444" }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#fbbf24" }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#4ade80" }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-mono truncate">
              {pub.filename}
            </span>
          </div>

          <div className="py-2 overflow-auto scroll-slim font-mono">
            {pub.code.map((line, i) => {
              const empty = line.content.trim() === "";
              const tappable =
                (status === "inspecting" || status === "line_selected") &&
                !empty;
              const selected = pendingLineId === line.id;
              const isBug = revealBug === line.id;
              const isWrongPick = wrongLineId === line.id;
              const locked = status === "diagnosing" && selected;

              let bg = "transparent";
              let border = "transparent";
              if (locked) {
                bg = "rgba(74,222,128,0.1)";
                border = "#4ade80";
              } else if (
                showResult &&
                isBug &&
                lastResult?.outcome === "correct"
              ) {
                bg = "rgba(74,222,128,0.1)";
                border = "#4ade80";
              } else if (showResult && isBug) {
                bg = "rgba(251,191,36,0.1)";
                border = "#fbbf24";
              } else if (showResult && isWrongPick) {
                bg = "rgba(239,68,68,0.1)";
                border = "#ef4444";
              }

              return (
                <button
                  key={line.id}
                  type="button"
                  disabled={!tappable}
                  onClick={() => tapLine(line.id)}
                  className="w-full flex items-start text-left px-3 py-1.5 active:bg-[rgba(99,102,241,0.1)] disabled:active:bg-transparent"
                  style={{
                    background: bg,
                    borderLeft: `3px solid ${border}`,
                    minHeight: "2rem",
                  }}
                >
                  <span
                    className="w-6 text-right mr-3 text-xs shrink-0 tabular-nums pt-0.5"
                    style={{ color: "#374151" }}
                    aria-hidden
                  >
                    {empty ? "" : i + 1}
                  </span>
                  <span className="flex-1 text-[13px] leading-relaxed whitespace-pre-wrap break-all">
                    {tokenize(line.content, pub.language).map((tok, j) => (
                      <span key={j} style={{ color: TOKEN_COLORS[tok.k] }}>
                        {tok.t}
                      </span>
                    ))}
                  </span>
                  {locked && (
                    <Check
                      className="w-4 h-4 shrink-0 ml-1 mt-0.5"
                      style={{ color: "#4ade80" }}
                    />
                  )}
                  {showResult && isBug && lastResult?.outcome !== "correct" && (
                    <span
                      className="text-[10px] shrink-0 ml-1 mt-1"
                      style={{ color: "#fbbf24" }}
                    >
                      bug
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Diagnosis options */}
        <AnimatePresence>
          {status === "diagnosing" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2 mt-3 pb-4"
            >
              {pub.diagnosisOptions.map((o, i) => (
                <button
                  key={o.id}
                  onClick={() => tapOption(o.id)}
                  className="flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-2xl border border-border active:scale-[0.99] transition-transform"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <span
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      color: "#a78bfa",
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm">{o.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Result sheet */}
      <AnimatePresence>
        {showResult && lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] p-4 z-40"
          >
            <div
              className="rounded-3xl border p-4 shadow-2xl"
              style={{
                background: "#0d0d1c",
                borderColor:
                  lastResult.outcome === "correct"
                    ? "rgba(74,222,128,0.4)"
                    : "rgba(239,68,68,0.4)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {lastResult.outcome === "correct" ? (
                  <span
                    className="flex items-center gap-1.5 text-sm font-bold"
                    style={{ color: "#4ade80" }}
                  >
                    <Check className="w-4 h-4" /> Correct · +
                    {lastResult.scoreAwarded}
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-1.5 text-sm font-bold"
                    style={{ color: "#ef4444" }}
                  >
                    <X className="w-4 h-4" />
                    {lastResult.outcome === "timeout"
                      ? "Time's up"
                      : "Not quite"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {lastResult.bugLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                {lastResult.explanation}
              </p>
              <div
                className="rounded-xl border px-3 py-2 mb-3"
                style={{
                  background: "rgba(249,115,22,0.06)",
                  borderColor: "rgba(249,115,22,0.2)",
                }}
              >
                <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">
                  {lastResult.outcome === "correct"
                    ? "Disaster you prevented"
                    : "This would hit production"}
                </div>
                <div
                  className="flex items-start gap-1.5 text-xs"
                  style={{ color: "#f97316" }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{lastResult.productionImpact?.metric}</span>
                </div>
              </div>
              <button
                onClick={nextRound}
                autoFocus
                className="w-full py-3 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                  color: "#fff",
                }}
              >
                Next
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
