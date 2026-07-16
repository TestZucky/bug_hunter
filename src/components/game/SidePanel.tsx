"use client";

import { motion } from "motion/react";
import { Clock, Heart, Star, Zap, Activity } from "lucide-react";
import { getRankProgress } from "@/lib/ranks";
import { comboMultiplier } from "@/lib/scoring";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";

export function SidePanel() {
  const config = useGameStore((s) => s.config);
  const timeLeft = useGameStore((s) => s.timeLeftSec);
  const totalSec = useGameStore((s) => s.totalSec);
  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const lives = useGameStore((s) => s.lives);
  const health = useGameStore((s) => s.systemHealth);
  const sessionXp = useGameStore((s) => s.xp);
  const roundIndex = useGameStore((s) => s.roundIndex);

  const totalXp = useUserStore((s) => s.totalXp);
  const { rank, next, progress } = getRankProgress(totalXp + sessionXp);

  const mode = config?.mode ?? "classic";
  const isPractice = mode === "practice";
  const isProduction = mode === "production";
  const timerPct = totalSec > 0 ? (timeLeft / totalSec) * 100 : 0;
  const timerColor =
    timerPct > 50 ? "#4ade80" : timerPct > 25 ? "#fbbf24" : "#ef4444";
  const comboMult = comboMultiplier(combo);
  const totalRounds = config?.totalRounds;

  return (
    <div className="w-full lg:w-64 xl:w-72 flex flex-col gap-3 shrink-0">
      {/* Timer */}
      {!isPractice && (
        <div
          className="rounded-2xl border border-border p-4"
          style={{ background: "rgba(13,13,28,0.9)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Clock className="w-3.5 h-3.5" /> Timer
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{ color: timerColor }}
              aria-live="polite"
            >
              {timeLeft}s
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
            role="progressbar"
            aria-valuenow={timeLeft}
            aria-valuemax={totalSec}
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
      )}

      {/* Score + Combo */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-2xl border border-border p-3"
          style={{ background: "rgba(13,13,28,0.9)" }}
        >
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <Star className="w-3 h-3" /> Score
          </div>
          <div className="text-lg font-bold tabular-nums">
            {score.toLocaleString()}
          </div>
        </div>
        <div
          className="rounded-2xl border p-3 transition-all"
          style={{
            background: combo > 0 ? "rgba(99,102,241,0.1)" : "rgba(13,13,28,0.9)",
            borderColor: combo > 0 ? "rgba(99,102,241,0.3)" : "var(--border)",
          }}
        >
          <div
            className="flex items-center gap-1 text-xs mb-1"
            style={{ color: combo > 0 ? "#a78bfa" : "#64748b" }}
          >
            <Zap className="w-3 h-3" /> Combo
          </div>
          <div
            className="text-lg font-bold tabular-nums"
            style={{ color: combo > 0 ? "#a78bfa" : "#e2e8f0" }}
          >
            ×{comboMult.toFixed(1)}
          </div>
        </div>
      </div>

      {/* System Health */}
      {!isPractice && (
        <div
          className="rounded-2xl border border-border p-3"
          style={{ background: "rgba(13,13,28,0.9)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> System Health
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{
                color: health > 50 ? "#4ade80" : health > 25 ? "#fbbf24" : "#ef4444",
              }}
            >
              {health}%
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${health}%` }}
              transition={{ duration: 0.4 }}
              style={{
                background:
                  health > 50 ? "#4ade80" : health > 25 ? "#fbbf24" : "#ef4444",
              }}
            />
          </div>
          {/* Lives (classic/daily) */}
          {!isProduction && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" /> Lives
              </span>
              <div className="flex gap-1">
                {Array.from({ length: config?.lives ?? 3 }).map((_, i) => (
                  <Heart
                    key={i}
                    className="w-4 h-4"
                    style={{
                      color: i < lives ? "#ef4444" : "#1e293b",
                      fill: i < lives ? "#ef4444" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* XP / Rank */}
      <div
        className="rounded-2xl border border-border p-3"
        style={{ background: "rgba(13,13,28,0.9)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5">
            <span className="text-base" aria-hidden>
              {rank.icon}
            </span>
            <span className="text-xs font-semibold" style={{ color: rank.color }}>
              {rank.name}
            </span>
          </span>
          {next && (
            <span className="text-xs text-muted-foreground">→ {next.name}</span>
          )}
        </div>
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: rank.color }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground font-mono">
            +{sessionXp} XP this run
          </span>
          {next && (
            <span className="text-xs text-muted-foreground font-mono">
              {next.minXP.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Round progress */}
      <div
        className="rounded-2xl border border-border p-3 text-xs text-muted-foreground flex items-center justify-between"
        style={{ background: "rgba(13,13,28,0.9)" }}
      >
        <span>Round</span>
        <span className="font-mono font-semibold text-foreground">
          {roundIndex + 1}
          {totalRounds ? ` / ${totalRounds}` : ""}
        </span>
      </div>
    </div>
  );
}
