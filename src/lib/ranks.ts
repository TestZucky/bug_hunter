export interface Rank {
  name: string;
  minXP: number;
  color: string;
  icon: string;
}

/** Config-driven rank thresholds (TDD §11.10). */
export const RANKS: Rank[] = [
  { name: "Bug Spotter", minXP: 0, color: "#94a3b8", icon: "🐛" },
  { name: "Junior Debugger", minXP: 500, color: "#60a5fa", icon: "🔍" },
  { name: "Code Detective", minXP: 1500, color: "#a78bfa", icon: "🕵️" },
  { name: "Bug Slayer", minXP: 3500, color: "#f59e0b", icon: "⚔️" },
  { name: "Production Guardian", minXP: 7500, color: "#4ade80", icon: "🛡️" },
  { name: "Principal Bug Hunter", minXP: 15000, color: "#f472b6", icon: "👑" },
];

export interface RankProgress {
  rank: Rank;
  next: Rank | null;
  /** 0–100 progress toward the next rank. */
  progress: number;
  level: number;
}

export function getRankProgress(xp: number): RankProgress {
  let idx = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXP) {
      idx = i;
      break;
    }
  }
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const ceiling = next ? next.minXP : rank.minXP + 5000;
  const progress = Math.min(
    ((xp - rank.minXP) / (ceiling - rank.minXP)) * 100,
    100,
  );
  return { rank, next, progress, level: idx + 1 };
}

/** Simple level curve derived from XP (used for the profile display). */
export function getLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}
