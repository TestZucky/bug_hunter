import { CHALLENGES } from "@/content/challenges";
import type {
  Category,
  Challenge,
  Difficulty,
  Language,
  PublicChallenge,
} from "@/types/challenge";

/**
 * Strip all answer keys so nothing correctness-related reaches the game UI.
 * Options are also shuffled deterministically per challenge so the correct
 * answer isn't always first (TDD §18.1).
 */
export function toPublicChallenge(c: Challenge): PublicChallenge {
  const seed = hashString(c.id);
  return {
    id: c.id,
    title: c.title,
    filename: c.filename,
    language: c.language,
    difficulty: c.difficulty,
    category: c.category,
    bugType: c.bugType,
    code: c.code,
    diagnosisOptions: shuffle(
      c.diagnosisOptions.map((o) => ({ id: o.id, label: o.label })),
      seed,
    ),
    fixOptions: shuffle(
      c.fixOptions.map((o) => ({ id: o.id, code: o.code })),
      seed + 1,
    ),
    estimatedTimeSeconds: c.estimatedTimeSeconds,
    baseScore: c.baseScore,
    xpReward: c.xpReward,
    tags: c.tags,
  };
}

export function getChallengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

/** Answer key lookups — used by the (local) grading layer, never exposed raw. */
export function isBugLineCorrect(c: Challenge, lineId: string): boolean {
  return c.bugLineIds.includes(lineId);
}
export function isDiagnosisCorrect(c: Challenge, optionId: string): boolean {
  return c.diagnosisOptions.some((o) => o.id === optionId && o.isCorrect);
}
export function isFixCorrect(c: Challenge, optionId: string): boolean {
  return c.fixOptions.some((o) => o.id === optionId && o.isCorrect);
}
export function correctFix(c: Challenge) {
  return c.fixOptions.find((o) => o.isCorrect);
}
export function correctDiagnosis(c: Challenge) {
  return c.diagnosisOptions.find((o) => o.isCorrect);
}

export interface SelectionQuery {
  language?: Language | "mixed";
  difficulty?: Difficulty | "adaptive";
  category?: Category | "any";
  count: number;
  /** Challenge ids already seen this session (avoid repeats). */
  exclude?: string[];
  /** Deterministic ordering seed (daily mode). */
  seed?: string;
}

function matches(c: Challenge, q: SelectionQuery): boolean {
  if (q.language && q.language !== "mixed" && c.language !== q.language)
    return false;
  if (q.difficulty && q.difficulty !== "adaptive" && c.difficulty !== q.difficulty)
    return false;
  if (q.category && q.category !== "any" && c.category !== q.category)
    return false;
  return true;
}

/** Pick a pool of challenges matching the query, avoiding repeats. */
export function selectChallenges(q: SelectionQuery): Challenge[] {
  const exclude = new Set(q.exclude ?? []);
  let pool = CHALLENGES.filter((c) => !exclude.has(c.id) && matches(c, q));

  // If filtering emptied the pool, relax the exclude list rather than fail.
  if (pool.length === 0) {
    pool = CHALLENGES.filter((c) => matches(c, q));
  }

  const ordered = q.seed
    ? seededShuffle(pool, q.seed)
    : shuffle(pool, Date.now() & 0xffff);
  return ordered.slice(0, q.count);
}

/**
 * Build a difficulty-laddered classic run: easy → medium → hard as rounds
 * progress. Falls back gracefully when a bucket is short.
 */
export function buildClassicRun(
  language: Language | "mixed",
  totalRounds: number,
  seed?: string,
): Challenge[] {
  const buckets: Record<Difficulty, Challenge[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  for (const c of CHALLENGES) {
    if (language !== "mixed" && c.language !== language) continue;
    buckets[c.difficulty].push(c);
  }
  const s = seed ?? String(Date.now());
  buckets.easy = seededShuffle(buckets.easy, s + "e");
  buckets.medium = seededShuffle(buckets.medium, s + "m");
  buckets.hard = seededShuffle(buckets.hard, s + "h");

  // Rough ladder: first 40% easy, next 40% medium, last 20% hard.
  const easyCount = Math.max(1, Math.round(totalRounds * 0.4));
  const mediumCount = Math.max(1, Math.round(totalRounds * 0.4));
  const order: Challenge[] = [
    ...buckets.easy.slice(0, easyCount),
    ...buckets.medium.slice(0, mediumCount),
    ...buckets.hard,
  ];

  // Backfill from the full matching pool if we came up short.
  if (order.length < totalRounds) {
    const seen = new Set(order.map((c) => c.id));
    const extra = seededShuffle(
      CHALLENGES.filter(
        (c) =>
          !seen.has(c.id) &&
          (language === "mixed" || c.language === language),
      ),
      s + "x",
    );
    order.push(...extra);
  }
  return order.slice(0, totalRounds);
}

// ─── Deterministic helpers ────────────────────────────────────────────────

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  return shuffle(arr, hashString(seed));
}

/** Today's date key (local) used to seed the daily challenge. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
