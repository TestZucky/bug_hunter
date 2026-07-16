"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  Crown,
  RotateCcw,
  Share2,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore, type SessionOutcome } from "@/stores/userStore";

export function SessionSummary({ onPlayAgain }: { onPlayAgain: () => void }) {
  const buildSummary = useGameStore((s) => s.buildSummary);
  const recordSession = useUserStore((s) => s.recordSession);
  const recorded = useRef(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  const [summary] = useState(() => buildSummary());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    setOutcome(recordSession(summary));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareText = `I scored ${summary.finalScore.toLocaleString()} in Bug Hunter (${summary.accuracy}% accuracy, ${summary.maxCombo}× combo). Can you debug faster? 🐛`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bug Hunter", text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled */
    }
  }

  const stats = [
    { label: "Score", value: summary.finalScore.toLocaleString(), icon: Target },
    { label: "XP Earned", value: `+${summary.xpEarned}`, icon: Zap },
    { label: "Accuracy", value: `${summary.accuracy}%`, icon: TrendingUp },
    { label: "Max Combo", value: `${summary.maxCombo}×`, icon: Award },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-4 overflow-auto scroll-slim">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="w-full max-w-md rounded-3xl border border-border p-6 sm:p-8 text-center"
        style={{ background: "#0d0d1c", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="text-5xl mb-3" aria-hidden>
          {summary.accuracy >= 80 ? "🏆" : summary.accuracy >= 50 ? "🎯" : "💀"}
        </div>
        <h1 className="text-xl font-bold mb-1">
          {summary.systemHealth <= 0
            ? "System Down"
            : summary.accuracy >= 80
            ? "Production Secured"
            : "Session Complete"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {summary.correctRounds}/{summary.totalRounds} rounds cleared
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 border border-border"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <s.icon className="w-3 h-3" /> {s.label}
              </div>
              <div className="text-xl font-bold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {outcome?.rankedUp && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-4 p-2.5 rounded-xl"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
          >
            <Crown className="w-4 h-4" style={{ color: outcome.rankAfter.color }} />
            <span className="text-sm font-semibold">
              Ranked up to{" "}
              <span style={{ color: outcome.rankAfter.color }}>
                {outcome.rankAfter.name}
              </span>
            </span>
          </motion.div>
        )}
        {outcome?.isNewBest && !outcome.rankedUp && (
          <div
            className="mb-4 p-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
          >
            🎉 New personal best!
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #6366f1, #7c3aed)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
            }}
          >
            <RotateCcw className="w-4 h-4" /> Play again
          </button>
          <div className="flex gap-2">
            <button
              onClick={share}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <Share2 className="w-4 h-4" /> {copied ? "Copied!" : "Share"}
            </button>
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              Home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
