/** Apply Drizzle migrations. Usage: npm run db:migrate */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { describeError, logger } from "@/lib/logger";

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* no .env — rely on the real environment */
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    logger.error("DATABASE_URL is not set — cannot migrate");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  logger.info("Applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  logger.info("Migrations applied.");
}

main().catch((err) => {
  logger.error("Migration failed", describeError(err));
  process.exit(1);
});
