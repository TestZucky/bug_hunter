/**
 * Review and publish generated challenges.
 *
 *   npm run challenges -- drafts              list challenges awaiting review
 *   npm run challenges -- show <id>           print one in full (answers included)
 *   npm run challenges -- publish <id...>     make drafts visible to players
 *   npm run challenges -- unpublish <id...>   pull challenges back out of the game
 *
 * Generated challenges land as drafts (see upsertMany) and only reach players
 * when a human runs `publish`. Read `show` output before promoting: the verify
 * pass has approved challenges whose "correct" fix provably breaks the code.
 *
 * Env:
 *   DATABASE_URL  (required) — the bank you are publishing from. For production
 *                 that means an SSH tunnel to the VM; `make drafts` handles it.
 */
import { getById, getDrafts, setStatus } from "@/db/challenges.repo";
import { describeError, logger } from "@/lib/logger";

const C = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

const USAGE = `Usage:
  npm run challenges -- drafts
  npm run challenges -- show <id>
  npm run challenges -- publish <id> [id...]
  npm run challenges -- unpublish <id> [id...]`;

async function drafts() {
  const rows = await getDrafts();
  if (rows.length === 0) {
    console.log(C.dim("No drafts awaiting review."));
    return;
  }
  console.log(C.bold(`\n${rows.length} draft(s) awaiting review:\n`));
  for (const r of rows) {
    console.log(`  ${r.id}`);
    console.log(C.dim(`    ${r.title}  [${r.language}] source=${r.source}`));
  }
  console.log(
    C.dim(`\nInspect one:  npm run challenges -- show <id>`) +
      C.dim(`\nThen publish: npm run challenges -- publish <id>\n`),
  );
}

async function show(id: string) {
  const c = await getById(id);
  if (!c) {
    console.error(`No challenge with id "${id}".`);
    process.exit(1);
  }
  console.log(
    C.bold(`\n${c.title}`) + C.dim(`  [${c.language}/${c.difficulty}]`),
  );
  console.log(C.dim(`${c.filename}\n`));
  c.code.forEach((line, i) => {
    const isBug = c.bugLineIds.includes(line.id);
    const n = String(i + 1).padStart(2);
    console.log(
      isBug
        ? C.yellow(`  ${n} ▸ ${line.content}`)
        : C.dim(`  ${n}   ${line.content}`),
    );
  });
  console.log(C.bold("\n  Diagnosis:"));
  for (const o of c.diagnosisOptions) {
    console.log(
      o.isCorrect ? C.green(`    ✓ ${o.label}`) : C.dim(`    ✗ ${o.label}`),
    );
  }
  console.log(C.bold("\n  Fixes:"));
  for (const o of c.fixOptions) {
    console.log(
      o.isCorrect ? C.green(`    ✓ ${o.code}`) : C.dim(`    ✗ ${o.code}`),
    );
  }
  console.log(C.bold("\n  Explanation:"));
  console.log(C.dim(`    ${c.explanation}\n`));
  console.log(
    C.dim("  Check: is the ▸ line really the bug? does the ✓ fix work? is\n") +
      C.dim("  every ✗ option actually wrong? If unsure, do not publish.\n"),
  );
}

async function flip(ids: string[], status: "draft" | "published") {
  const changed = await setStatus(ids, status);
  const missing = ids.filter((i) => !changed.includes(i));
  if (changed.length) {
    const verb = status === "published" ? "published" : "unpublished";
    console.log(C.green(`${verb} ${changed.length}:`), changed.join(", "));
  }
  if (missing.length) {
    console.log(C.yellow(`not found (no such id):`), missing.join(", "));
    process.exitCode = 1;
  }
}

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* no .env — rely on the real environment */
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "drafts":
      return drafts();
    case "show":
      if (!rest[0]) return void console.error(USAGE);
      return show(rest[0]);
    case "publish":
      if (!rest.length) return void console.error(USAGE);
      return flip(rest, "published");
    case "unpublish":
      if (!rest.length) return void console.error(USAGE);
      return flip(rest, "draft");
    default:
      console.error(USAGE);
      process.exit(1);
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    logger.error("challenges-admin failed", describeError(err));
    process.exit(1);
  });
