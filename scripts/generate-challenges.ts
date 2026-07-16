/**
 * Generate-and-verify pipeline for Bug Hunter challenges (OpenAI).
 *
 *   npm run gen:challenges -- <language> [count]
 *   e.g.  npm run gen:challenges -- javascript 6
 *         npm run gen:challenges -- python 8
 *
 * Pipeline:  generate (OpenAI, structured output)
 *          → validate structure (your Zod schema)
 *          → dedup: exact (code/title hash) within batch AND vs existing bank
 *          → dedup: semantic (embedding cosine) vs existing bank AND kept batch
 *          → adversarial verify (a second, skeptical OpenAI pass)
 *          → gate: only verified candidates are written to ./generated/
 *
 * Nothing is auto-published into the app. Review ./generated/*.json, then paste
 * approved challenges into src/content/challenges/{javascript,python}.ts.
 *
 * Env:
 *   OPENAI_API_KEY         (required)
 *   OPENAI_MODEL           generation model     (default: gpt-4o)
 *   OPENAI_VERIFY_MODEL    verification model   (default: OPENAI_MODEL)
 *   OPENAI_EMBED_MODEL     embedding model      (default: text-embedding-3-small)
 *   DEDUP_SIM_THRESHOLD    near-dup cosine cutoff, 0-1 (default: 0.9)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import OpenAI from "openai";
// Reuse the exact schema the app validates against (this file only imports zod).
import { challengeSchema } from "../src/schemas/challenge.schema";
// The existing challenge bank, for cross-bank dedup (tsx resolves the @/ alias).
import { getAllPublished, upsertMany } from "@/db/challenges.repo";
import { describeError, logger } from "@/lib/logger";
import type { Challenge } from "@/types/challenge";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a network call on rate limits / 5xx / transport errors with backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retryable =
        status === undefined ||
        status === 429 ||
        (status >= 500 && status < 600);
      if (!retryable || i === attempts - 1) break;
      const delay = Math.min(1000 * 2 ** i, 8000);
      logger.warn(`${label} failed — retrying in ${delay}ms`, {
        attempt: `${i + 1}/${attempts}`,
        ...describeError(err),
      });
      await sleep(delay);
    }
  }
  throw lastErr;
}

// ─── Config ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "syntax",
  "variables",
  "conditions",
  "loops",
  "arrays",
  "functions",
  "null_handling",
  "async",
  "api",
  "sql",
  "security",
  "react",
  "state",
  "performance",
  "error_handling",
  "testing",
] as const;

const BUG_TYPES = [
  "syntax_error",
  "off_by_one",
  "null_reference",
  "undefined_access",
  "wrong_condition",
  "infinite_loop",
  "missing_return",
  "incorrect_mutation",
  "missing_await",
  "unhandled_promise",
  "race_condition",
  "sql_injection",
  "xss",
  "authentication_error",
  "authorization_error",
  "memory_leak",
  "performance_issue",
  "incorrect_query",
  "wrong_http_method",
  "wrong_status_code",
  "stale_state",
  "resource_leak",
  "type_mismatch",
  "loose_equality",
] as const;

const DIFFICULTY_DEFAULTS = {
  easy: { timeSeconds: 20, baseScore: 100, xpReward: 20 },
  medium: { timeSeconds: 15, baseScore: 200, xpReward: 35 },
  hard: { timeSeconds: 10, baseScore: 350, xpReward: 60 },
} as const;

type Language = "javascript" | "python";

// ─── OpenAI structured-output schemas ────────────────────────────────────────

/** The compact shape the model produces (language is supplied by us, not the model). */
const candidateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", description: "kebab-case, e.g. js-off-by-one-042" },
    title: { type: "string" },
    filename: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    category: { type: "string", enum: [...CATEGORIES] },
    bugType: { type: "string", enum: [...BUG_TYPES] },
    code: {
      type: "array",
      items: { type: "string" },
      description:
        "5-16 source lines, indentation preserved, exactly one real bug",
    },
    bugLines: {
      type: "array",
      items: { type: "integer" },
      description: "1-indexed line number(s) of the buggy line",
    },
    diagnosis: {
      type: "array",
      description:
        "3-4 options; EXACTLY ONE isCorrect:true; distractors clearly wrong",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          isCorrect: { type: "boolean" },
        },
        required: ["label", "isCorrect"],
      },
    },
    fixes: {
      type: "array",
      description:
        "2-3 options; EXACTLY ONE isCorrect:true; the correct one actually fixes it",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          isCorrect: { type: "boolean" },
        },
        required: ["code", "isCorrect"],
      },
    },
    explanation: { type: "string" },
    impact: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
        },
        metric: {
          type: "string",
          description:
            "punchy production consequence, e.g. '3,450 failed requests'",
        },
      },
      required: ["title", "description", "severity", "metric"],
    },
    tags: { type: "array", items: { type: "string" } },
  },
  required: [
    "id",
    "title",
    "filename",
    "difficulty",
    "category",
    "bugType",
    "code",
    "bugLines",
    "diagnosis",
    "fixes",
    "explanation",
    "impact",
    "tags",
  ],
} as const;

const generationSchema = {
  type: "object",
  additionalProperties: false,
  properties: { challenges: { type: "array", items: candidateSchema } },
  required: ["challenges"],
} as const;

const verdictSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    isRealBug: { type: "boolean" },
    flaggedLineIsTheBug: { type: "boolean" },
    exactlyOneCorrectDiagnosis: { type: "boolean" },
    fixActuallyFixes: { type: "boolean" },
    distractorsClearlyWrong: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: [
    "approved",
    "confidence",
    "isRealBug",
    "flaggedLineIsTheBug",
    "exactlyOneCorrectDiagnosis",
    "fixActuallyFixes",
    "distractorsClearlyWrong",
    "issues",
  ],
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  title: string;
  filename: string;
  difficulty: "easy" | "medium" | "hard";
  category: (typeof CATEGORIES)[number];
  bugType: (typeof BUG_TYPES)[number];
  code: string[];
  bugLines: number[];
  diagnosis: { label: string; isCorrect: boolean }[];
  fixes: { code: string; isCorrect: boolean }[];
  explanation: string;
  impact: {
    title: string;
    description: string;
    severity: string;
    metric: string;
  };
  tags: string[];
}

interface Verdict {
  approved: boolean;
  confidence: "low" | "medium" | "high";
  isRealBug: boolean;
  flaggedLineIsTheBug: boolean;
  exactlyOneCorrectDiagnosis: boolean;
  fixActuallyFixes: boolean;
  distractorsClearlyWrong: boolean;
  issues: string[];
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

function generationPrompt(language: Language, count: number): string {
  const langName = language === "python" ? "Python" : "JavaScript/TypeScript";
  return `You are an expert ${langName} engineer writing debugging challenges for a game.

Produce ${count} DISTINCT challenges. Each shows a short, realistic ${langName} snippet
containing EXACTLY ONE bug on a specific line. The player taps the buggy line, then
picks the correct diagnosis.

Hard requirements — a challenge is useless if any is violated:
- The snippet must contain a genuine bug that a competent reviewer agrees on.
- 'bugLines' points at the single line where the bug lives (1-indexed).
- 'diagnosis' has 3-4 options with EXACTLY ONE isCorrect:true. The correct one must be
  the actual reason it fails; distractors must be plausible-sounding but clearly wrong.
- 'fixes' has 2-3 options with EXACTLY ONE isCorrect:true, and that fix must truly
  correct the bug. Wrong fixes must not accidentally also work.
- 'explanation' explains why the original fails in 1-2 sentences.
- 'impact.metric' is a punchy, concrete production consequence.
- Vary difficulty, category, and bugType across the set. Avoid trivial or contrived bugs.
- Keep snippets 5-16 lines. Preserve indentation in each 'code' line.
- Make ids unique and kebab-case.`;
}

function verifyPrompt(): string {
  return `You are a STRICT adversarial reviewer for a debugging game. Your job is to find
reasons to REJECT a challenge, not to be charitable. Default to approved:false when
uncertain.

You are given a challenge with its marked answers. Independently verify:
1. isRealBug — the flagged code genuinely contains a real bug (not a style nit / non-bug).
2. flaggedLineIsTheBug — the bug is actually on the flagged line(s), and there is only one bug.
3. exactlyOneCorrectDiagnosis — exactly one diagnosis is correct AND it is the true reason;
   no distractor is also arguably correct.
4. fixActuallyFixes — the fix marked correct genuinely fixes the bug, and no "wrong" fix
   also works.
5. distractorsClearlyWrong — wrong options are clearly wrong to a competent engineer.

Set approved:true ONLY if all five are true. List concrete issues for anything that fails.`;
}

// ─── OpenAI calls ────────────────────────────────────────────────────────────

async function callJSON<T>(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  schemaName: string,
  schema: object,
): Promise<T> {
  const res = await withRetry(
    () =>
      client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema: schema as Record<string, unknown>,
          },
        },
      }),
    `chat.completions(${schemaName})`,
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content) as T;
}

async function generate(
  client: OpenAI,
  model: string,
  language: Language,
  count: number,
): Promise<Candidate[]> {
  const data = await callJSON<{ challenges: Candidate[] }>(
    client,
    model,
    generationPrompt(language, count),
    `Generate ${count} ${language} challenges now.`,
    "challenge_batch",
    generationSchema,
  );
  return data.challenges ?? [];
}

async function verify(
  client: OpenAI,
  model: string,
  full: unknown,
): Promise<Verdict> {
  return callJSON<Verdict>(
    client,
    model,
    verifyPrompt(),
    "Review this challenge (answers included):\n\n" +
      JSON.stringify(full, null, 2),
    "verdict",
    verdictSchema,
  );
}

// ─── Build + validate ────────────────────────────────────────────────────────

function toChallenge(c: Candidate, language: Language, idx: number) {
  const d = DIFFICULTY_DEFAULTS[c.difficulty];
  return {
    id:
      c.id || `${language === "python" ? "py" : "js"}-gen-${c.bugType}-${idx}`,
    title: c.title,
    filename: c.filename,
    language,
    difficulty: c.difficulty,
    category: c.category,
    bugType: c.bugType,
    code: c.code.map((content, i) => ({ id: `l${i + 1}`, content })),
    bugLineIds: c.bugLines.map((n) => `l${n}`),
    diagnosisOptions: c.diagnosis.map((o, i) => ({
      id: `d${i + 1}`,
      label: o.label,
      isCorrect: o.isCorrect,
    })),
    fixOptions: c.fixes.map((o, i) => ({
      id: `f${i + 1}`,
      code: o.code,
      isCorrect: o.isCorrect,
    })),
    explanation: c.explanation,
    productionImpact: c.impact,
    estimatedTimeSeconds: d.timeSeconds,
    baseScore: d.baseScore,
    xpReward: d.xpReward,
    tags: c.tags ?? [],
  };
}

function codeHash(lines: string[]): string {
  const norm = lines.join("\n").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha1").update(norm).digest("hex");
}

function normTitle(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Hashes + titles of the challenges already in the bank, for cross-bank dedup. */
function existingFingerprints(existing: Challenge[]) {
  const codeHashes = new Set(
    existing.map((c) => codeHash(c.code.map((l) => l.content))),
  );
  const titles = new Set(existing.map((c) => normTitle(c.title)));
  return { codeHashes, titles };
}

/** A semantic representation of a challenge — what it teaches, not its exact text. */
function embedTextFor(
  code: string[],
  explanation: string,
  bugType: string,
  category: string,
): string {
  return `bug:${bugType} category:${category}\n${code.join("\n")}\n${explanation}`;
}

async function embedTexts(
  client: OpenAI,
  model: string,
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await withRetry(
    () => client.embeddings.create({ model, input: texts }),
    "embeddings.create",
  );
  return res.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[]);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseLang(arg: string | undefined): Language {
  const a = (arg ?? "").toLowerCase();
  if (a === "python" || a === "py") return "python";
  if (a === "javascript" || a === "js" || a === "ts" || a === "typescript")
    return "javascript";
  throw new Error(`Unknown language "${arg}". Use "javascript" or "python".`);
}

const C = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function main() {
  // Load a local .env if present (Node 21.7+). In CI/cron the key comes from the
  // real environment, and this simply no-ops.
  try {
    process.loadEnvFile();
  } catch {
    /* no .env file — rely on the real environment */
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error(C.red("OPENAI_API_KEY is not set."));
    console.error(
      C.dim("  Local:  create a .env file with  OPENAI_API_KEY=sk-..."),
    );
    console.error(
      C.dim("  Or:     export OPENAI_API_KEY=sk-...  in your shell"),
    );
    process.exit(1);
  }

  const language = parseLang(process.argv[2]);
  const count = Math.max(1, Math.min(20, Number(process.argv[3] ?? 6)));
  const genModel = process.env.OPENAI_MODEL || "gpt-4o";
  const verifyModel = process.env.OPENAI_VERIFY_MODEL || genModel;

  const client = new OpenAI();

  console.log(
    C.bold(`\nBug Hunter — generate & verify`) +
      C.dim(
        `  (${language}, ${count} candidates, gen=${genModel}, verify=${verifyModel})\n`,
      ),
  );

  // 1. Generate
  console.log(C.dim("→ generating candidates…"));
  let candidates: Candidate[];
  try {
    candidates = await generate(client, genModel, language, count);
  } catch (err) {
    logger.error("Generation failed", describeError(err));
    process.exit(1);
  }
  console.log(C.dim(`  got ${candidates.length}`));

  // 2. Structural validation + 3. dedup (within the batch AND against the existing bank)
  const seen = new Set<string>();
  const existingChallenges = await getAllPublished().catch((err) => {
    logger.warn(
      "Could not read existing challenges from DB — batch-only dedup",
      {
        ...describeError(err),
      },
    );
    return [] as Challenge[];
  });
  const existing = existingFingerprints(existingChallenges);
  console.log(
    C.dim(
      `  cross-bank dedup against ${existingChallenges.length} existing challenges`,
    ),
  );
  const structurallyValid: {
    full: ReturnType<typeof toChallenge>;
    cand: Candidate;
  }[] = [];
  const rejected: { id: string; stage: string; reasons: string[] }[] = [];

  candidates.forEach((cand, i) => {
    const full = toChallenge(cand, language, i);
    const parsed = challengeSchema.safeParse(full);
    if (!parsed.success) {
      rejected.push({
        id: full.id,
        stage: "schema",
        reasons: parsed.error.issues.map(
          (x) => `${x.path.join(".")}: ${x.message}`,
        ),
      });
      return;
    }
    const h = codeHash(cand.code);
    // Cross-bank: reject if the code or the title already exists in the app.
    if (
      existing.codeHashes.has(h) ||
      existing.titles.has(normTitle(cand.title))
    ) {
      rejected.push({
        id: full.id,
        stage: "duplicate-bank",
        reasons: ["already exists in the challenge bank (code or title match)"],
      });
      return;
    }
    // Within-batch dedup.
    if (seen.has(h)) {
      rejected.push({
        id: full.id,
        stage: "duplicate-batch",
        reasons: ["near-duplicate code in batch"],
      });
      return;
    }
    seen.add(h);
    structurallyValid.push({ full, cand });
  });

  // 3b. Embedding-based near-duplicate check (semantic, catches renamed/reworded dups)
  let toVerify = structurallyValid;
  const threshold = Number(process.env.DEDUP_SIM_THRESHOLD ?? 0.9);
  const embedModel = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
  if (structurallyValid.length > 0) {
    console.log(
      C.dim(
        `→ embedding near-dup check (model=${embedModel}, threshold=${threshold})…`,
      ),
    );
    try {
      const [existingEmb, candEmb] = await Promise.all([
        embedTexts(
          client,
          embedModel,
          existingChallenges.map((c) =>
            embedTextFor(
              c.code.map((l) => l.content),
              c.explanation,
              c.bugType,
              c.category,
            ),
          ),
        ),
        embedTexts(
          client,
          embedModel,
          structurallyValid.map(({ cand }) =>
            embedTextFor(
              cand.code,
              cand.explanation,
              cand.bugType,
              cand.category,
            ),
          ),
        ),
      ]);

      const kept: typeof structurallyValid = [];
      const keptEmb: number[][] = [];
      structurallyValid.forEach((s, i) => {
        const emb = candEmb[i];
        let best = { sim: -1, id: "" };
        existingEmb.forEach((e, j) => {
          const sim = cosine(emb, e);
          if (sim > best.sim) best = { sim, id: existingChallenges[j].id };
        });
        keptEmb.forEach((e, k) => {
          const sim = cosine(emb, e);
          if (sim > best.sim) best = { sim, id: `${kept[k].full.id} (batch)` };
        });
        if (best.sim >= threshold) {
          rejected.push({
            id: s.full.id,
            stage: "near-duplicate",
            reasons: [`~${best.sim.toFixed(3)} cosine to ${best.id}`],
          });
        } else {
          console.log(
            C.dim(
              `  ${s.full.id}: nearest ${best.id} @ ${best.sim.toFixed(3)}`,
            ),
          );
          kept.push(s);
          keptEmb.push(emb);
        }
      });
      toVerify = kept;
    } catch (err) {
      logger.warn("Embedding near-dup check skipped — using hash dedup only", {
        ...describeError(err),
      });
    }
  }

  // 4. Adversarial verification (in parallel — the batch is small)
  console.log(C.dim(`→ verifying ${toVerify.length} candidates…`));
  const verified = await Promise.all(
    toVerify.map(async ({ full }) => {
      try {
        const verdict = await verify(client, verifyModel, full);
        return { full, verdict };
      } catch (err) {
        return {
          full,
          verdict: {
            approved: false,
            confidence: "low",
            issues: ["verification call failed: " + describeError(err).message],
          } as Verdict,
        };
      }
    }),
  );

  const approved = verified.filter((v) => v.verdict.approved);
  for (const v of verified) {
    if (!v.verdict.approved) {
      rejected.push({
        id: v.full.id,
        stage: "verify",
        reasons: v.verdict.issues.length
          ? v.verdict.issues
          : ["rejected by verifier"],
      });
    }
  }

  // 5. Report
  console.log("\n" + C.bold("Results"));
  for (const v of verified) {
    if (v.verdict.approved) {
      console.log(
        `  ${C.green("✓")} ${v.full.id} ` +
          C.dim(
            `[${v.full.difficulty}/${v.full.bugType}] confidence=${v.verdict.confidence}`,
          ),
      );
    }
  }
  for (const r of rejected) {
    console.log(`  ${C.red("✗")} ${r.id} ${C.yellow(`(${r.stage})`)}`);
    for (const reason of r.reasons.slice(0, 3))
      console.log(C.dim(`      - ${reason}`));
  }

  console.log(
    "\n" +
      C.bold(
        `${approved.length} approved · ${rejected.length} rejected · ${candidates.length} generated`,
      ),
  );

  // 6. Write approved to ./generated (review before pasting into the app)
  if (approved.length > 0) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const outDir = path.join(here, "..", "generated");
    mkdirSync(outDir, { recursive: true });
    // Timestamp is fine in a normal Node script.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outFile = path.join(outDir, `challenges-${language}-${stamp}.json`);
    writeFileSync(
      outFile,
      JSON.stringify(
        approved.map((v) => v.full),
        null,
        2,
      ),
    );
    console.log(
      C.dim(
        `\nWrote approved challenges → ${path.relative(process.cwd(), outFile)}`,
      ),
    );

    // Optionally write straight to the DB with --write-db.
    if (process.argv.includes("--write-db")) {
      const stampDate = new Date().toISOString().slice(0, 10);
      await upsertMany(
        approved.map((v) => v.full as Challenge),
        `llm-${stampDate}`,
      );
      console.log(
        C.dim(`Upserted ${approved.length} approved challenges into the DB.\n`),
      );
    } else {
      console.log(
        C.dim("Review the file, then run again with --write-db to publish.\n"),
      );
    }
  } else {
    console.log(
      C.dim("\nNothing approved this run — tighten the prompt or re-run.\n"),
    );
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", describeError(reason));
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", describeError(err));
  process.exit(1);
});

main().catch((err) => {
  logger.error("Unexpected error", describeError(err));
  process.exit(1);
});
