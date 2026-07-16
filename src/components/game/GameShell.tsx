"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bug, Info, Lightbulb, Pause, Play, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TOKEN_COLORS, tokenize } from "@/lib/syntax";
import { comboMultiplier } from "@/lib/scoring";
import { useTimer } from "@/hooks/useTimer";
import { useSound } from "@/hooks/useSound";
import { useGameStore } from "@/stores/gameStore";
import { AnswerPanel } from "./AnswerPanel";
import { CodeEditor } from "./CodeEditor";
import { Confetti } from "./Confetti";
import { GameHeader } from "./GameHeader";
import { RoundResult } from "./RoundResult";
import { SessionSummary } from "./SessionSummary";
import { SidePanel } from "./SidePanel";

const MODE_LABELS: Record<string, string> = {
  classic: "Classic",
  production: "Production Emergency",
  daily: "Daily Challenge",
  practice: "Practice",
};

export function GameShell({ onExit }: { onExit: () => void }) {
  useTimer();
  const { play, vibrate } = useSound();

  const status = useGameStore((s) => s.status);
  const roundIndex = useGameStore((s) => s.roundIndex);
  const config = useGameStore((s) => s.config);
  const pendingLineId = useGameStore((s) => s.pendingLineId);
  const pendingDiagnosisId = useGameStore((s) => s.pendingDiagnosisId);
  const pendingFixId = useGameStore((s) => s.pendingFixId);
  const shake = useGameStore((s) => s.shake);
  const wrongLineId = useGameStore((s) => s.wrongLineId);
  const combo = useGameStore((s) => s.combo);
  const timeLeft = useGameStore((s) => s.timeLeftSec);
  const lastResult = useGameStore((s) => s.lastResult);
  const hintUsed = useGameStore((s) => s.hintUsed);

  const selectLine = useGameStore((s) => s.selectLine);
  const submitLine = useGameStore((s) => s.submitLine);
  const selectDiagnosis = useGameStore((s) => s.selectDiagnosis);
  const submitDiagnosis = useGameStore((s) => s.submitDiagnosis);
  const selectFix = useGameStore((s) => s.selectFix);
  const submitFix = useGameStore((s) => s.submitFix);
  const useHint = useGameStore((s) => s.useHint);
  const nextRound = useGameStore((s) => s.nextRound);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);

  const publicChallenge = useGameStore((s) => s.currentPublic)();
  const challenge = useGameStore((s) => s.currentChallenge)();

  const [showConfetti, setShowConfetti] = useState(false);
  const [showComboToast, setShowComboToast] = useState(false);

  // ── Sound + effects ──────────────────────────────────────────────
  const prevShake = useRef(shake);
  const prevStatus = useRef(status);
  const warned = useRef(false);
  const lastResultRef = useRef(lastResult);

  useEffect(() => {
    if (shake > prevShake.current) {
      play("wrong");
      vibrate(120);
    }
    prevShake.current = shake;
  }, [shake, play, vibrate]);

  useEffect(() => {
    // Stage advanced without a miss → soft select blip.
    const advanced =
      (prevStatus.current === "line_selected" && status === "diagnosing") ||
      (prevStatus.current === "diagnosing" && status === "fixing");
    if (advanced) play("select");
    if (status === "inspecting" || status === "round_intro") warned.current = false;
    prevStatus.current = status;
  }, [status, play]);

  useEffect(() => {
    if (lastResult && lastResult !== lastResultRef.current) {
      if (lastResult.outcome === "correct") {
        play(lastResult.newCombo > 1 ? "combo" : "correct");
        vibrate([20, 40, 20]);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1400);
        if (lastResult.newCombo > 1) {
          setShowComboToast(true);
          setTimeout(() => setShowComboToast(false), 1400);
        }
      } else {
        play("wrong");
      }
    }
    lastResultRef.current = lastResult;
  }, [lastResult, play, vibrate]);

  useEffect(() => {
    const active =
      status === "inspecting" ||
      status === "line_selected" ||
      status === "diagnosing" ||
      status === "fixing";
    if (active && timeLeft <= 5 && timeLeft > 0 && !warned.current) {
      play("warning");
      warned.current = true;
    }
  }, [timeLeft, status, play]);

  // ── Primary action per stage ─────────────────────────────────────
  const primaryAction = useCallback(() => {
    if (status === "line_selected") submitLine();
    else if (status === "diagnosing") submitDiagnosis();
    else if (status === "fixing") submitFix();
    else if (status === "round_result") nextRound();
  }, [status, submitLine, submitDiagnosis, submitFix, nextRound]);

  const primaryEnabled =
    (status === "line_selected" && !!pendingLineId) ||
    (status === "diagnosing" && !!pendingDiagnosisId) ||
    (status === "fixing" && !!pendingFixId);

  const primaryLabel =
    status === "line_selected"
      ? "Find Bug"
      : status === "diagnosing"
      ? "Confirm Diagnosis"
      : status === "fixing"
      ? "Ship Fix"
      : status === "inspecting"
      ? "Select a line"
      : "Next";

  // ── Keyboard controls ────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") {
        if (status === "paused") resume();
        else pause();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        primaryAction();
        return;
      }
      if (e.key === " " && status === "round_result") {
        e.preventDefault();
        nextRound();
        return;
      }
      // Number keys select options.
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && publicChallenge) {
        if (status === "diagnosing") {
          const opt = publicChallenge.diagnosisOptions[n - 1];
          if (opt) selectDiagnosis(opt.id);
        } else if (status === "fixing") {
          const opt = publicChallenge.fixOptions[n - 1];
          if (opt) selectFix(opt.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    status,
    publicChallenge,
    primaryAction,
    nextRound,
    pause,
    resume,
    selectDiagnosis,
    selectFix,
  ]);

  if (status === "session_complete") {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden">
        <GameHeader modeLabel={config ? MODE_LABELS[config.mode] : undefined} />
        <SessionSummary onPlayAgain={onExit} />
      </div>
    );
  }

  if (!publicChallenge || !challenge) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const comboMult = comboMultiplier(combo);
  const showResult = status === "round_result";

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden select-none">
      {showConfetti && <Confetti />}
      <GameHeader modeLabel={config ? MODE_LABELS[config.mode] : undefined} />

      {/* Combo toast */}
      <AnimatePresence>
        {showComboToast && (
          <motion.div
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm pointer-events-none"
            style={{
              background: "linear-gradient(135deg, #6366f1, #a78bfa)",
              color: "#fff",
              boxShadow: "0 0 30px rgba(99,102,241,0.5)",
            }}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 1.1 }}
          >
            <Zap className="w-4 h-4" />
            {combo}× Combo · ×{comboMult.toFixed(1)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-3 sm:p-4 min-h-0 overflow-auto lg:overflow-hidden scroll-slim">
        {/* Left: editor + stage panels */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Challenge meta */}
          <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">
                {publicChallenge.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {publicChallenge.language === "python" ? "Python" : "JS/TS"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {status === "inspecting" || status === "line_selected"
                ? "Step 1 · Find the bug"
                : status === "diagnosing"
                ? "Step 2 · Diagnose"
                : status === "fixing"
                ? "Step 3 · Fix"
                : "Result"}
            </span>
          </div>

          <CodeEditor
            title={publicChallenge.title}
            filename={publicChallenge.filename}
            code={publicChallenge.code}
            language={publicChallenge.language}
            status={status}
            pendingLineId={pendingLineId}
            correctLineId={showResult ? lastResult?.correctLineId ?? null : null}
            wrongLineId={wrongLineId}
            outcome={showResult ? lastResult?.outcome ?? null : null}
            shakeKey={shake}
            onSelectLine={(id) => {
              selectLine(id);
              play("select");
            }}
          />

          {/* Hint banner */}
          {hintUsed && !showResult && (
            <div
              className="rounded-xl border px-3 py-2 text-xs flex items-center gap-2 shrink-0"
              style={{
                background: "rgba(34,211,238,0.06)",
                borderColor: "rgba(34,211,238,0.25)",
                color: "#22d3ee",
              }}
            >
              <Lightbulb className="w-3.5 h-3.5 shrink-0" />
              Hint: this is a <strong>{challenge.category.replace(/_/g, " ")}</strong>{" "}
              bug. Look for a <strong>{challenge.bugType.replace(/_/g, " ")}</strong>.
            </div>
          )}

          {/* Diagnose stage */}
          {status === "diagnosing" && (
            <AnswerPanel
              heading="Why does this code fail?"
              hint="Pick the best diagnosis · keys 1–3"
              accent="#6366f1"
              selectedId={pendingDiagnosisId}
              onSelect={(id) => {
                selectDiagnosis(id);
                play("select");
              }}
              options={publicChallenge.diagnosisOptions.map((o) => ({
                id: o.id,
                content: o.label,
              }))}
            />
          )}

          {/* Fix stage */}
          {status === "fixing" && (
            <AnswerPanel
              heading="Choose the safest fix"
              hint="keys 1–3"
              accent="#4ade80"
              selectedId={pendingFixId}
              onSelect={(id) => {
                selectFix(id);
                play("select");
              }}
              options={publicChallenge.fixOptions.map((o) => ({
                id: o.id,
                content: (
                  <code className="font-mono text-xs whitespace-pre-wrap break-all">
                    {tokenize(o.code, publicChallenge.language).map((tok, j) => (
                      <span key={j} style={{ color: TOKEN_COLORS[tok.k] }}>
                        {tok.t}
                      </span>
                    ))}
                  </code>
                ),
              }))}
            />
          )}

          {/* Result */}
          <AnimatePresence mode="wait">
            {showResult && <RoundResult key="result" onNext={nextRound} />}
          </AnimatePresence>
        </div>

        {/* Right: stats */}
        <SidePanel />
      </div>

      {/* Bottom action bar */}
      {!showResult && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 shrink-0">
          <div className="flex gap-3">
            <button
              onClick={primaryAction}
              disabled={!primaryEnabled}
              className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                color: "#fff",
                boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
              }}
            >
              <Bug className="w-4 h-4" />
              {primaryLabel}
            </button>

            <button
              onClick={() => {
                useHint();
                play("select");
              }}
              disabled={hintUsed}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-sm border transition-colors disabled:opacity-40"
              style={{
                background: "rgba(34,211,238,0.08)",
                borderColor: "rgba(34,211,238,0.25)",
                color: "#22d3ee",
              }}
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">Hint</span>
            </button>

            <button
              onClick={() => (status === "paused" ? resume() : pause())}
              aria-label={status === "paused" ? "Resume" : "Pause"}
              className="flex items-center justify-center px-4 py-3.5 rounded-2xl border border-border text-muted-foreground hover:text-foreground transition-colors"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              {status === "paused" ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      <AnimatePresence>
        {status === "paused" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(7,7,15,0.85)", backdropFilter: "blur(12px)" }}
          >
            <div
              className="rounded-3xl border border-border p-8 w-72 text-center"
              style={{ background: "#0d0d1c" }}
            >
              <Pause className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <h2 className="text-lg font-bold mb-4">Paused</h2>
              <button
                onClick={resume}
                className="w-full py-3 rounded-2xl font-semibold text-sm mb-2"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                  color: "#fff",
                }}
              >
                Resume
              </button>
              <button
                onClick={onExit}
                className="w-full py-2.5 rounded-2xl font-semibold text-sm border border-border text-muted-foreground hover:text-foreground"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                Quit run
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
