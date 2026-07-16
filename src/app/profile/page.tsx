"use client";

import { motion } from "motion/react";
import {
  Award,
  Flame,
  Gamepad2,
  Pencil,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { useHydrated } from "@/hooks/useHydrated";
import { getLevel, getRankProgress, RANKS } from "@/lib/ranks";
import { useUserStore } from "@/stores/userStore";

export default function ProfilePage() {
  const store = useUserStore();
  const {
    displayName,
    totalXp,
    dailyStreak,
    longestStreak,
    gamesPlayed,
    totalCorrect,
    totalRounds,
    maxCombo,
  } = store;

  const { rank, next, progress } = getRankProgress(totalXp);
  const level = getLevel(totalXp);
  const accuracy =
    totalRounds > 0 ? Math.round((totalCorrect / totalRounds) * 100) : 0;

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const hydrated = useHydrated();

  // Until the persisted store rehydrates on the client, render a stable shell
  // that matches the server output (avoids a hydration mismatch).
  if (!hydrated) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <PageHeader title="Profile" />
      </div>
    );
  }

  const stats = [
    { label: "Games", value: gamesPlayed, icon: Gamepad2 },
    { label: "Accuracy", value: `${accuracy}%`, icon: Target },
    { label: "Best Combo", value: `${maxCombo}×`, icon: Award },
    { label: "Longest Streak", value: `${longestStreak}d`, icon: Flame },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <PageHeader title="Profile" />
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border p-6 mb-4"
          style={{ background: "rgba(13,13,28,0.9)" }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: `${rank.color}22` }}
            >
              {rank.icon}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    store.setDisplayName(nameDraft);
                    setEditing(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={24}
                    className="bg-transparent border-b border-border text-lg font-bold outline-none focus:border-primary px-1 py-0.5 min-w-0"
                  />
                  <button
                    type="submit"
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ background: "#6366f1", color: "#fff" }}
                  >
                    Save
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold truncate">{displayName}</h1>
                  <button
                    onClick={() => {
                      setNameDraft(displayName);
                      setEditing(true);
                    }}
                    aria-label="Edit name"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 text-sm">
                <span className="font-semibold" style={{ color: rank.color }}>
                  {rank.name}
                </span>
                <span className="text-muted-foreground">· Level {level}</span>
              </div>
            </div>
          </div>

          {/* XP progress */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-mono">{totalXp.toLocaleString()} XP</span>
              {next && (
                <span>
                  {next.icon} {next.name} at {next.minXP.toLocaleString()}
                </span>
              )}
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: rank.color }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border p-4"
              style={{ background: "rgba(13,13,28,0.9)" }}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <div className="text-xl font-bold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Current streak + XP callouts */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className="rounded-2xl border border-border p-4 flex items-center gap-3"
            style={{ background: "rgba(251,191,36,0.06)" }}
          >
            <Flame className="w-6 h-6" style={{ color: "#fbbf24" }} />
            <div>
              <div className="text-xl font-bold">{dailyStreak}</div>
              <div className="text-xs text-muted-foreground">day streak</div>
            </div>
          </div>
          <div
            className="rounded-2xl border border-border p-4 flex items-center gap-3"
            style={{ background: "rgba(99,102,241,0.06)" }}
          >
            <TrendingUp className="w-6 h-6" style={{ color: "#a78bfa" }} />
            <div>
              <div className="text-xl font-bold">{totalCorrect}</div>
              <div className="text-xs text-muted-foreground">bugs squashed</div>
            </div>
          </div>
        </div>

        {/* Rank ladder */}
        <div
          className="rounded-2xl border border-border p-4 mb-4"
          style={{ background: "rgba(13,13,28,0.9)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4" style={{ color: "#fbbf24" }} />
            <span className="text-sm font-semibold">Ranks</span>
          </div>
          <div className="space-y-2">
            {RANKS.map((r) => {
              const reached = totalXp >= r.minXP;
              const current = r.name === rank.name;
              return (
                <div
                  key={r.name}
                  className="flex items-center gap-3 text-sm"
                  style={{ opacity: reached ? 1 : 0.45 }}
                >
                  <span className="text-lg w-6 text-center" aria-hidden>
                    {r.icon}
                  </span>
                  <span
                    className="flex-1 font-medium"
                    style={{ color: current ? r.color : undefined }}
                  >
                    {r.name}
                    {current && (
                      <span
                        className="ml-2 text-xs px-1.5 py-0.5 rounded"
                        style={{ background: `${r.color}22`, color: r.color }}
                      >
                        current
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.minXP.toLocaleString()} XP
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => {
            if (confirm("Reset all local progress? This cannot be undone.")) {
              store.resetProgress();
            }
          }}
          className="w-full py-3 rounded-2xl text-sm font-semibold border border-border text-muted-foreground hover:text-destructive transition-colors"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          Reset progress
        </button>
        <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
          <Zap className="w-3 h-3" /> Progress is saved locally in this browser.
        </p>
      </main>
    </div>
  );
}
