import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Challenge } from "@/types/challenge";

/**
 * The challenge bank. `payload` holds the full Challenge (INCLUDING answers) as
 * jsonb — it lives only in the database and is never sent to the browser raw.
 * The scalar columns exist for cheap filtering (language/status/difficulty).
 */
export const challenges = pgTable(
  "challenges",
  {
    id: text("id").primaryKey(),
    language: text("language").notNull(),
    difficulty: text("difficulty").notNull(),
    category: text("category").notNull(),
    bugType: text("bug_type").notNull(),
    status: text("status").notNull().default("published"),
    /** Full Challenge object with answer keys — server-only. */
    payload: jsonb("payload").$type<Challenge>().notNull(),
    /** Provenance: 'seed' | 'llm-YYYY-MM-DD'. */
    source: text("source").notNull().default("seed"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    languageIdx: index("challenges_language_idx").on(t.language),
    statusIdx: index("challenges_status_idx").on(t.status),
  }),
);

export type ChallengeRow = typeof challenges.$inferSelect;
export type NewChallengeRow = typeof challenges.$inferInsert;
