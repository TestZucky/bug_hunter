import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Server-only database client. Never import this from a client component — it
 * pulls in `pg` and reads DATABASE_URL, which must stay on the server.
 *
 * Lazily initialized: importing `db` does nothing until the first query, so
 * scripts/tests can import modules that reference it without a live connection.
 */

type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __bhPool?: Pool; __bhDb?: DB };

function init(): DB {
  if (globalForDb.__bhDb) return globalForDb.__bhDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env (or run `docker compose up -d db`) and set it.",
    );
  }
  const pool =
    globalForDb.__bhPool ?? new Pool({ connectionString: url, max: 10 });
  const instance = drizzle(pool, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__bhPool = pool;
    globalForDb.__bhDb = instance;
  }
  return instance;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = init() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
