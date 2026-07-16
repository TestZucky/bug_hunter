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
import {
  deleteDrafts,
  getById,
  getDrafts,
  setStatus,
} from "@/db/challenges.repo";
import { describeError, logger } from "@/lib/logger";
import type { Challenge } from "@/types/challenge";

const C = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

const USAGE = `Usage:
  npm run challenges -- review              step through drafts, approve by keypress
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

/** Render a challenge with its answer key. Shared by `show` and `review`. */
function render(c: Challenge) {
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
}

const CHECKLIST =
  C.dim("  Check: is the ▸ line really the bug? does the ✓ fix work? is\n") +
  C.dim("  every ✗ option actually wrong? If unsure, do not publish.\n");

async function show(id: string) {
  const c = await getById(id);
  if (!c) {
    console.error(`No challenge with id "${id}".`);
    process.exit(1);
  }
  render(c);
  console.log(CHECKLIST);
}

// A piped stdin delivers several keystrokes in one chunk ("psq"), so keys are
// queued and handed out one per prompt. Listeners are attached once: a listener
// per read lets an already-resolved read's handler eat the next read's key.
const pendingKeys: string[] = [];
let stdinEnded = false;
let waiting: ((key: string) => void) | null = null;
let stdinWired = false;

/** Give the next queued key (or "q" at EOF) to whoever is waiting. */
function serveWaiter() {
  if (!waiting) return;
  while (pendingKeys.length) {
    const k = pendingKeys.shift()!;
    if (k.trim()) {
      const resolve = waiting;
      waiting = null;
      resolve(k.trim().slice(0, 1).toLowerCase());
      return;
    }
  }
  if (stdinEnded) {
    const resolve = waiting;
    waiting = null;
    resolve("q");
  }
}

function wireStdin() {
  if (stdinWired) return;
  stdinWired = true;
  process.stdin.on("data", (d: Buffer) => {
    pendingKeys.push(...d.toString().split(""));
    serveWaiter();
  });
  process.stdin.on("end", () => {
    stdinEnded = true;
    serveWaiter();
  });
  process.stdin.resume();
}

/**
 * One keypress, no Enter. Falls back to buffered reads when stdin isn't a TTY
 * (piped input, CI) so the flow stays scriptable and testable.
 */
function readKey(): Promise<string> {
  const stdin = process.stdin;

  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      waiting = resolve;
      wireStdin();
      serveWaiter();
    });
  }

  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.once("data", (d: Buffer) => {
      stdin.setRawMode(false);
      stdin.pause();
      const k = d.toString();
      // Ctrl-C must still quit.
      if (k === "") {
        console.log("");
        process.exit(130);
      }
      resolve(k.trim().toLowerCase());
    });
  });
}

/** Walk every draft: read it, then publish / delete / skip by keypress. */
async function review() {
  const drafts = await getDrafts();
  if (drafts.length === 0) {
    console.log(C.dim("No drafts awaiting review."));
    return;
  }
  console.log(C.bold(`\nReviewing ${drafts.length} draft(s).`));

  const published: string[] = [];
  const deleted: string[] = [];
  const skipped: string[] = [];

  for (const [i, d] of drafts.entries()) {
    const c = await getById(d.id);
    if (!c) continue;
    console.log(C.dim("\n" + "─".repeat(66)));
    console.log(C.dim(`(${i + 1}/${drafts.length})  ${d.id}`));
    render(c);
    console.log(CHECKLIST);
    process.stdout.write(
      C.bold("  [p]") +
        "ublish  " +
        C.bold("[d]") +
        "elete  " +
        C.bold("[s]") +
        "kip  " +
        C.bold("[q]") +
        "uit > ",
    );
    const key = await readKey();
    console.log(key);

    if (key === "p") {
      await setStatus([d.id], "published");
      published.push(d.id);
      console.log(C.green("  → published, live now"));
    } else if (key === "d") {
      await deleteDrafts([d.id]);
      deleted.push(d.id);
      console.log(C.yellow("  → deleted"));
    } else if (key === "q") {
      console.log(C.dim("  → quitting; the rest stay as drafts"));
      break;
    } else {
      skipped.push(d.id);
      console.log(C.dim("  → skipped, stays a draft"));
    }
  }

  console.log(C.bold("\nDone."));
  console.log(`  published: ${published.length}  ${published.join(", ")}`);
  console.log(`  deleted:   ${deleted.length}  ${deleted.join(", ")}`);
  console.log(`  skipped:   ${skipped.length}  ${skipped.join(", ")}`);
  if (published.length) {
    console.log(
      C.dim("\nPublished challenges are live immediately — no deploy needed."),
    );
    console.log(C.dim("Worth refreshing your backup:  make backup\n"));
  }
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
    case "review":
      return review();
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
