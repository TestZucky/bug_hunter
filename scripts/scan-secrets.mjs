/**
 * Lightweight secret scanner. Fails (exit 1) if a likely credential is found.
 *
 *   node scripts/scan-secrets.mjs            # scan all tracked files (CI)
 *   node scripts/scan-secrets.mjs --staged   # scan only staged changes (pre-commit)
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RULES = [
  { name: "OpenAI API key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "OpenAI project key", re: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  {
    name: "Private key block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
  },
];

// Files that legitimately contain example/placeholder patterns or the rules above.
const IGNORE_FILES = new Set([".env.example", "scripts/scan-secrets.mjs"]);
const IGNORE_EXT =
  /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|lock)$|package-lock\.json$/;

const staged = process.argv.includes("--staged");

let files;
try {
  const cmd = staged
    ? "git diff --cached --name-only --diff-filter=ACM"
    : "git ls-files";
  files = execSync(cmd, { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  console.log("Not a git repo or git unavailable — skipping secret scan.");
  process.exit(0);
}

const findings = [];
for (const file of files) {
  if (IGNORE_FILES.has(file) || IGNORE_EXT.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        findings.push({ file, line: i + 1, rule: rule.name });
      }
    }
  });
}

if (findings.length > 0) {
  console.error("\x1b[31m✖ Potential secrets detected:\x1b[0m");
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}`);
  console.error(
    "\nMove secrets to environment variables / .env (git-ignored) and try again.",
  );
  process.exit(1);
}

console.log("\x1b[32m✔ No secrets detected\x1b[0m");
