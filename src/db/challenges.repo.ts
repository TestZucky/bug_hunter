// NOTE: server-only module — importing `pg` keeps it out of client bundles.
// (We avoid the `server-only` package because Node scripts/tests import this too.)
import { and, desc, eq, inArray } from "drizzle-orm";
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

/** Outcome of an {@link upsertMany} call. */
export type UpsertReport = {
  /** Ids that did not exist and were created. */
  inserted: string[];
  /** Ids that already existed under the same `source` and were replaced. */
  updated: string[];
  /** Ids left untouched because another `source` owns them. */
  skipped: { id: string; existingSource: string }[];
};

/**
 * Insert challenges, updating only the rows this `source` already owns.
 *
 * A row is never modified when its stored `source` differs from the incoming
 * one, so generated content cannot overwrite hand-written seed challenges that
 * happen to share an id — the model picks its own ids and does reuse existing
 * ones. Conflicts are reported back rather than written, and callers should
 * surface them: a silent overwrite destroys the original payload.
 *
 * Writes land as "draft" unless a caller explicitly asks to publish. Drafts are
 * invisible to players (`getPool` selects only "published"), which keeps
 * unreviewed machine-generated challenges out of the game by default.
 */
export async function upsertMany(
  items: Challenge[],
  source: string,
  status: "draft" | "published" = "draft",
): Promise<UpsertReport> {
  const report: UpsertReport = { inserted: [], updated: [], skipped: [] };
  if (items.length === 0) return report;

  const existing = await db
    .select({ id: challenges.id, source: challenges.source })
    .from(challenges)
    .where(
      inArray(
        challenges.id,
        items.map((c) => c.id),
      ),
    );
  const owners = new Map(existing.map((r) => [r.id, r.source]));

  for (const c of items) {
    const owner = owners.get(c.id);
    if (owner !== undefined && owner !== source) {
      report.skipped.push({ id: c.id, existingSource: owner });
      continue;
    }
    const row: NewChallengeRow = {
      id: c.id,
      language: c.language,
      difficulty: c.difficulty,
      category: c.category,
      bugType: c.bugType,
      status,
      payload: c,
      source,
    };
    const written = await db
      .insert(challenges)
      .values(row)
      .onConflictDoUpdate({
        target: challenges.id,
        // Re-checked at write time: a row owned by another source stays put
        // even if it appears between the read above and this statement.
        setWhere: eq(challenges.source, source),
        set: {
          payload: row.payload,
          language: row.language,
          difficulty: row.difficulty,
          category: row.category,
          bugType: row.bugType,
          status,
          source,
          updatedAt: new Date(),
        },
      })
      .returning({ id: challenges.id });

    if (written.length === 0) {
      report.skipped.push({ id: c.id, existingSource: owner ?? "unknown" });
    } else if (owner === undefined) {
      report.inserted.push(c.id);
    } else {
      report.updated.push(c.id);
    }
  }
  return report;
}

/** Challenges awaiting review, newest first. Drafts are never served to players. */
export async function getDrafts(): Promise<
  { id: string; language: string; source: string; title: string }[]
> {
  const rows = await db
    .select({
      id: challenges.id,
      language: challenges.language,
      source: challenges.source,
      payload: challenges.payload,
    })
    .from(challenges)
    .where(eq(challenges.status, "draft"))
    .orderBy(desc(challenges.createdAt));
  return rows.map((r) => ({
    id: r.id,
    language: r.language,
    source: r.source,
    title: r.payload.title,
  }));
}

/**
 * Flip challenges between draft and published. Returns the ids actually
 * changed, so a caller can tell a typo'd id from a real promotion.
 */
export async function setStatus(
  ids: string[],
  status: "draft" | "published",
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .update(challenges)
    .set({ status, updatedAt: new Date() })
    .where(inArray(challenges.id, ids))
    .returning({ id: challenges.id });
  return rows.map((r) => r.id);
}

/**
 * Hard-delete rejected drafts. Returns the ids actually removed.
 *
 * Only ever deletes rows in "draft" status — published and seed content cannot
 * be destroyed through this path, whatever ids a caller passes.
 */
export async function deleteDrafts(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .delete(challenges)
    .where(and(inArray(challenges.id, ids), eq(challenges.status, "draft")))
    .returning({ id: challenges.id });
  return rows.map((r) => r.id);
}

/** All published challenges (used by the pipeline for cross-bank dedup). */
export async function getAllPublished(): Promise<Challenge[]> {
  const rows = await db
    .select({ payload: challenges.payload })
    .from(challenges)
    .where(eq(challenges.status, "published"));
  return rows.map((r) => r.payload);
}
