import type {
  Challenge,
  Difficulty,
  Language,
  PublicChallenge,
} from "@/types/challenge";
import type { RevealPayload } from "@/types/game";

/**
 * Pure challenge helpers — NO database or content import, so this is safe to use
 * on both the server (grading) and, for the type-only pieces, the client.
 *
 * The answer-bearing functions (grading, reveal, toPublicChallenge) are only
 * ever called on the server; the client receives PublicChallenge and reveal
 * payloads over the API.
 */

// ─── Answer-safe projection ───────────────────────────────────────────────

/** Strip all answer keys and deterministically shuffle options (TDD §18.1). */
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

// ─── Grading (server-only) ─────────────────────────────────────────────────

export function isBugLineCorrect(c: Challenge, lineId: string | null): boolean {
  return lineId != null && c.bugLineIds.includes(lineId);
}
export function isDiagnosisCorrect(
  c: Challenge,
  optionId: string | null,
): boolean {
  return c.diagnosisOptions.some((o) => o.id === optionId && o.isCorrect);
}
export function isFixCorrect(c: Challenge, optionId: string | null): boolean {
  return c.fixOptions.some((o) => o.id === optionId && o.isCorrect);
}
export function correctFix(c: Challenge) {
  return c.fixOptions.find((o) => o.isCorrect);
}
export function correctDiagnosis(c: Challenge) {
  return c.diagnosisOptions.find((o) => o.isCorrect);
}

export function buildReveal(c: Challenge): RevealPayload {
  const fix = correctFix(c);
  const diag = correctDiagnosis(c);
  return {
    bugLabel: bugLabel(c.bugType),
    explanation: c.explanation,
    productionImpact: c.productionImpact,
    correctLineId: c.bugLineIds[0],
    correctDiagnosisId: diag?.id ?? "",
    correctFixCode: fix?.code ?? "",
  };
}

/** Human-readable bug label from the bug type. */
export function bugLabel(bugType: string): string {
  const map: Record<string, string> = {
    off_by_one: "Off-by-One Error",
    null_reference: "Null Reference",
    undefined_access: "Undefined Access",
    missing_await: "Missing Await",
    unhandled_promise: "Unhandled Rejection",
    race_condition: "Race Condition",
    sql_injection: "SQL Injection",
    xss: "XSS Vulnerability",
    authorization_error: "Broken Authorization",
    authentication_error: "Auth Vulnerability",
    memory_leak: "Memory Leak",
    resource_leak: "Resource Leak",
    performance_issue: "Performance Issue",
    incorrect_mutation: "Incorrect Mutation",
    wrong_condition: "Wrong Condition",
    wrong_status_code: "Wrong Status Code",
    loose_equality: "Loose Equality",
    type_mismatch: "Type Mismatch",
    missing_return: "Missing Return",
    stale_state: "Stale State",
    infinite_loop: "Infinite Loop",
    syntax_error: "Syntax Error",
  };
  return map[bugType] ?? "Bug";
}

// ─── Selection over a pool (pure; the pool comes from the DB) ───────────────

/** Difficulty-laddered run from a candidate pool (easy → medium → hard). */
export function buildRunFrom(
  pool: Challenge[],
  language: Language | "mixed",
  count: number,
  seed?: string,
): Challenge[] {
  const buckets: Record<Difficulty, Challenge[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  for (const c of pool) {
    if (language !== "mixed" && c.language !== language) continue;
    buckets[c.difficulty].push(c);
  }
  const s = seed ?? "run";
  buckets.easy = seededShuffle(buckets.easy, s + "e");
  buckets.medium = seededShuffle(buckets.medium, s + "m");
  buckets.hard = seededShuffle(buckets.hard, s + "h");

  const easyCount = Math.max(1, Math.round(count * 0.4));
  const mediumCount = Math.max(1, Math.round(count * 0.4));
  const order: Challenge[] = [
    ...buckets.easy.slice(0, easyCount),
    ...buckets.medium.slice(0, mediumCount),
    ...buckets.hard,
  ];

  if (order.length < count) {
    const seen = new Set(order.map((c) => c.id));
    const extra = seededShuffle(
      pool.filter(
        (c) =>
          !seen.has(c.id) && (language === "mixed" || c.language === language),
      ),
      s + "x",
    );
    order.push(...extra);
  }
  return order.slice(0, count);
}

// ─── Deterministic helpers ─────────────────────────────────────────────────

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
