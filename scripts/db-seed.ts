/**
 * Seed the challenges table from a git-ignored seed file.
 *
 *   npm run db:seed                 # reads seed/challenges.json
 *   npm run db:seed -- path.json    # custom file
 *
 * Idempotent: upserts by challenge id. Validates every record against the same
 * Zod schema the app uses, so malformed data never lands in the DB.
 */
import { existsSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { challengeSchema } from "@/schemas/challenge.schema";
import { challenges } from "@/db/schema";
import type { NewChallengeRow } from "@/db/schema";
import { describeError, logger } from "@/lib/logger";

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* no .env */
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    logger.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const file = process.argv[2] ?? "seed/challenges.json";
  if (!existsSync(file)) {
    logger.error(
      `Seed file "${file}" not found. Run "npm run db:export" first, or point at a JSON file. ` +
        "The baseline data is intentionally NOT in git.",
    );
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw)) {
    logger.error("Seed file must contain a JSON array of challenges");
    process.exit(1);
  }

  const rows: NewChallengeRow[] = raw.map((c: unknown, i: number) => {
    const parsed = challengeSchema.safeParse(c);
    if (!parsed.success) {
      throw new Error(
        `Invalid challenge #${i}: ${parsed.error.issues.map((x) => x.message).join("; ")}`,
      );
    }
    const v = parsed.data;
    return {
      id: v.id,
      language: v.language,
      difficulty: v.difficulty,
      category: v.category,
      bugType: v.bugType,
      status: "published",
      payload: v,
      source: "seed",
    };
  });

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  for (const row of rows) {
    await db
      .insert(challenges)
      .values(row)
      .onConflictDoUpdate({
        target: challenges.id,
        set: {
          language: row.language,
          difficulty: row.difficulty,
          category: row.category,
          bugType: row.bugType,
          payload: row.payload,
          status: row.status,
          updatedAt: new Date(),
        },
      });
  }
  await pool.end();
  logger.info(`Seeded ${rows.length} challenges from ${file}`);
}

main().catch((err) => {
  logger.error("Seed failed", describeError(err));
  process.exit(1);
});
