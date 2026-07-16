"use client";

import Link from "next/link";
import { Bug, Flame, Home, Volume2, VolumeX } from "lucide-react";
import { getRankProgress } from "@/lib/ranks";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUserStore } from "@/stores/userStore";

export function GameHeader({ modeLabel }: { modeLabel?: string }) {
  const xp = useUserStore((s) => s.totalXp);
  const streak = useUserStore((s) => s.dailyStreak);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const { rank } = getRankProgress(xp);

  return (
    <header
      className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border shrink-0"
      style={{ background: "rgba(13,13,28,0.8)", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa)" }}
          >
            <Bug className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight hidden sm:inline">
            Bug<span style={{ color: "#6366f1" }}>Hunter</span>
          </span>
        </Link>
        {modeLabel && (
          <>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {modeLabel}
            </span>
          </>
        )}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
          style={{ background: "rgba(251,191,36,0.1)" }}
        >
          <Flame className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
          <span className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
            {streak}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <span className="text-sm" aria-hidden>
            {rank.icon}
          </span>
          <span
            className="text-xs font-semibold hidden sm:inline"
            style={{ color: rank.color }}
          >
            {rank.name}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            ·
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {xp.toLocaleString()} XP
          </span>
        </div>
        <button
          onClick={toggleSound}
          aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
        <Link
          href="/"
          aria-label="Quit to home"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <Home className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
