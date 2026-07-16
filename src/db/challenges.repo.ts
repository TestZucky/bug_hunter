// NOTE: server-only module — importing `pg` keeps it out of client bundles.
// (We avoid the `server-only` package because Node scripts/tests import this too.)
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { challenges, type NewChallengeRow } from "./schema";
import { buildRunFrom } from "@/services/challengeService";
import type { Challenge, Language } from "@/types/challenge";

/** All published challenges for a language (or all languages when "mixed"). */
export async function getPool(
  language: Language | "mixed",
): Promise<Challenge[]> {
  const where =
    language === "mixed"
      ? eq(challenges.status, "published")
      : and(
          eq(challenges.status, "published"),
          eq(challenges.language, language),
        );
  const rows = await db
    .select({ payload: challenges.payload })
    .from(challenges)
    .where(where);
  return rows.map((r) => r.payload);
}

/** Full challenge (WITH answers) by id — server-only, never returned raw to a client. */
export async function getById(id: string): Promise<Challenge | null> {
  const rows = await db
    .select({ payload: challenges.payload })
    .from(challenges)
    .where(eq(challenges.id, id))
    .limit(1);
  return rows[0]?.payload ?? null;
}

export async function getManyByIds(ids: string[]): Promise<Challenge[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ payload: challenges.payload })
    .from(challenges)
    .where(inArray(challenges.id, ids));
  return rows.map((r) => r.payload);
}

/** A difficulty-laddered run of full challenges from the DB. */
export async function buildRun(
  language: Language | "mixed",
  count: number,
  seed?: string,
): Promise<Challenge[]> {
  const pool = await getPool(language);
  return buildRunFrom(pool, language, count, seed);
}

/** Upsert challenges (used by the generation pipeline). */
export async function upsertMany(
  items: Challenge[],
  source: string,
): Promise<void> {
  for (const c of items) {
    const row: NewChallengeRow = {
      id: c.id,
      language: c.language,
      difficulty: c.difficulty,
      category: c.category,
      bugType: c.bugType,
      status: "published",
      payload: c,
      source,
    };
    await db
      .insert(challenges)
      .values(row)
      .onConflictDoUpdate({
        target: challenges.id,
        set: {
          payload: row.payload,
          language: row.language,
          difficulty: row.difficulty,
          category: row.category,
          bugType: row.bugType,
          source,
          updatedAt: new Date(),
        },
      });
  }
}

/** All published challenges (used by the pipeline for cross-bank dedup). */
export async function getAllPublished(): Promise<Challenge[]> {
  const rows = await db
    .select({ payload: challenges.payload })
    .from(challenges)
    .where(eq(challenges.status, "published"));
  return rows.map((r) => r.payload);
}
