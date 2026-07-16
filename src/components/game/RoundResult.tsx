"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  XCircle,
} from "lucide-react";
import { DIFFICULTY_COLORS } from "@/lib/constants";
import { TOKEN_COLORS, tokenize } from "@/lib/syntax";
import { useGameStore } from "@/stores/gameStore";

const SEVERITY_COLOR: Record<string, string> = {
  low: "#94a3b8",
  medium: "#fbbf24",
  high: "#f97316",
  critical: "#ef4444",
};

export function RoundResult({ onNext }: { onNext: () => void }) {
  const result = useGameStore((s) => s.lastResult);
  const challenge = useGameStore((s) => s.currentChallenge)();
  const gameOver = useGameStore((s) => s.gameOverReason);

  if (!result || !challenge) return null;

  const correct = result.outcome === "correct";
  const timeout = result.outcome === "timeout";
  const accent = correct ? "#4ade80" : "#ef4444";
  const impact = challenge.productionImpact;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl border p-4 shrink-0 overflow-auto scroll-slim"
      style={{
        background: correct ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)",
        borderColor: correct ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.25)",
        maxHeight: "40vh",
      }}
      role="alertdialog"
      aria-label="Round result"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 shrink-0">
            {correct ? (
              <CheckCircle className="w-5 h-5" style={{ color: accent }} />
            ) : timeout ? (
              <Clock className="w-5 h-5" style={{ color: accent }} />
            ) : (
              <XCircle className="w-5 h-5" style={{ color: accent }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {correct
                  ? "Bug squashed — " + result.bugLabel
                  : timeout
                  ? "Time's up — " + result.bugLabel
                  : "Missed it — " + result.bugLabel}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{
                  background: DIFFICULTY_COLORS[challenge.difficulty].bg,
                  color: DIFFICULTY_COLORS[challenge.difficulty].color,
                }}
              >
                {challenge.difficulty}
              </span>
              {correct && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}
                >
                  +{result.xpAwarded} XP · +{result.scoreAwarded.toLocaleString()}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              {result.explanation}
            </p>

            <div className="flex items-start gap-1.5 mb-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                Fix:
              </span>
              <code
                className="text-xs px-2 py-0.5 rounded font-mono break-all"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {tokenize(result.correctFixCode, challenge.language).map((tok, j) => (
                  <span key={j} style={{ color: TOKEN_COLORS[tok.k] }}>
                    {tok.t}
                  </span>
                ))}
              </code>
            </div>

            {/* Production impact */}
            <div
              className="rounded-lg border p-2.5 mt-2"
              style={{
                background: "rgba(249,115,22,0.05)",
                borderColor: "rgba(249,115,22,0.2)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: SEVERITY_COLOR[impact.severity] }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: SEVERITY_COLOR[impact.severity] }}
                >
                  {impact.title}
                </span>
                <span className="text-xs text-muted-foreground ml-auto uppercase tracking-wide">
                  {impact.severity}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {impact.description}
              </p>
              <p className="text-xs mt-1 font-mono" style={{ color: "#f97316" }}>
                {impact.metric}
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        autoFocus
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: correct
            ? "linear-gradient(135deg, #6366f1, #7c3aed)"
            : "rgba(255,255,255,0.06)",
          color: "#fff",
        }}
      >
        {gameOver ? "See results" : "Next round"}
        <ChevronRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
