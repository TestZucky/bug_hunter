/**
 * Small structured logger with secret redaction.
 *
 * - Level controlled by LOG_LEVEL (debug|info|warn|error), default "info".
 * - Pretty output by default; JSON lines when LOG_FORMAT=json or NODE_ENV=production.
 * - Every message and metadata value is passed through `redact()`, which scrubs
 *   API keys and the values of any *_KEY / *_SECRET / *_TOKEN / *_PASSWORD env vars,
 *   so credentials never reach the logs.
 *
 * Safe to import in both Node (scripts) and the browser (process is guarded).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function currentLevel(): LogLevel {
  const raw = (env("LOG_LEVEL") || "info").toLowerCase();
  return (["debug", "info", "warn", "error"] as LogLevel[]).includes(
    raw as LogLevel,
  )
    ? (raw as LogLevel)
    : "info";
}

function asJson(): boolean {
  return env("LOG_FORMAT") === "json" || env("NODE_ENV") === "production";
}

// ── Redaction ───────────────────────────────────────────────────────────────

const PATTERNS: [RegExp, string][] = [
  [/\bsk-[A-Za-z0-9_-]{10,}\b/g, "sk-***REDACTED***"], // OpenAI-style keys
  [/\bBearer\s+[A-Za-z0-9._-]{10,}/gi, "Bearer ***REDACTED***"],
  [
    /\b(api[_-]?key|secret|token|password)\b(["']?\s*[:=]\s*["']?)([A-Za-z0-9._\-/+]{8,})/gi,
    "$1$2***REDACTED***",
  ],
];

/** Collect the values of sensitive env vars so we can scrub them if they leak. */
function sensitiveEnvValues(): string[] {
  if (typeof process === "undefined" || !process.env) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (v && v.length >= 8 && /(KEY|SECRET|TOKEN|PASSWORD)/i.test(k))
      out.push(v);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redact(input: unknown): string {
  let text = typeof input === "string" ? input : safeStringify(input);
  for (const [re, rep] of PATTERNS) text = text.replace(re, rep);
  for (const value of sensitiveEnvValues()) {
    text = text.replace(new RegExp(escapeRegExp(value), "g"), "***REDACTED***");
  }
  return text;
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ── Emit ─────────────────────────────────────────────────────────────────────

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[currentLevel()]) return;

  const safeMsg = redact(msg);
  const safeMeta = meta ? JSON.parse(redact(meta)) : undefined;
  const time = new Date().toISOString();

  const write =
    level === "error" || level === "warn" ? console.error : console.log;

  if (asJson()) {
    write(JSON.stringify({ time, level, msg: safeMsg, ...(safeMeta ?? {}) }));
    return;
  }

  const colors: Record<LogLevel, string> = {
    debug: "\x1b[2m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  };
  const tag = `${colors[level]}${level.toUpperCase().padEnd(5)}\x1b[0m`;
  const metaStr = safeMeta ? " " + redact(safeMeta) : "";
  write(`\x1b[2m${time}\x1b[0m ${tag} ${safeMsg}${metaStr}`);
}

export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export const logger: Logger = {
  debug: (m, meta) => emit("debug", m, meta),
  info: (m, meta) => emit("info", m, meta),
  warn: (m, meta) => emit("warn", m, meta),
  error: (m, meta) => emit("error", m, meta),
};

/** Normalize an unknown thrown value into a redacted message + optional stack. */
export function describeError(err: unknown): {
  message: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return {
      message: redact(err.message),
      stack: err.stack ? redact(err.stack) : undefined,
    };
  }
  return { message: redact(safeStringify(err)) };
}
