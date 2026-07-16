import type { Language } from "@/types/challenge";

export type TokenKind =
  | "kw"
  | "str"
  | "num"
  | "cmt"
  | "fn"
  | "op"
  | "ty"
  | "txt";

export interface Token {
  t: string;
  k: TokenKind;
}

/** Token colors ported from the Figma export. */
export const TOKEN_COLORS: Record<TokenKind, string> = {
  kw: "#c084fc",
  str: "#fde68a",
  num: "#67e8f9",
  cmt: "#4b5563",
  fn: "#6ee7b7",
  op: "#64748b",
  ty: "#93c5fd",
  txt: "#cbd5e1",
};

const JS_KEYWORDS = new Set([
  "async", "await", "function", "return", "const", "let", "var", "if", "else",
  "for", "while", "throw", "new", "class", "extends", "import", "export",
  "default", "true", "false", "null", "undefined", "typeof", "instanceof",
  "try", "catch", "finally", "of", "in", "type", "interface", "Promise",
  "switch", "case", "break", "continue", "yield", "delete", "void", "do",
]);

const JS_TYPES = new Set([
  "string", "number", "boolean", "void", "any", "never", "unknown", "object",
  "NodeJS", "ProcessEnv", "Array", "Record", "Map", "Set",
]);

const PY_KEYWORDS = new Set([
  "def", "return", "if", "elif", "else", "for", "while", "in", "not", "and",
  "or", "import", "from", "as", "class", "try", "except", "finally", "raise",
  "with", "lambda", "yield", "async", "await", "pass", "break", "continue",
  "None", "True", "False", "global", "nonlocal", "assert", "del", "is",
]);

const PY_TYPES = new Set([
  "int", "str", "float", "bool", "list", "dict", "tuple", "set", "bytes",
  "None", "Optional", "List", "Dict", "Any",
]);

function keywordsFor(language: Language) {
  return language === "python"
    ? { kw: PY_KEYWORDS, ty: PY_TYPES, comment: "#" }
    : { kw: JS_KEYWORDS, ty: JS_TYPES, comment: "//" };
}

export function tokenize(line: string, language: Language): Token[] {
  const { kw, ty, comment } = keywordsFor(language);
  const toks: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Line comments
    if (
      (comment === "//" && line[i] === "/" && line[i + 1] === "/") ||
      (comment === "#" && line[i] === "#")
    ) {
      toks.push({ t: line.slice(i), k: "cmt" });
      break;
    }

    // Strings (single, double, backtick)
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) j++;
      toks.push({ t: line.slice(i, j + 1), k: "str" });
      i = j + 1;
      continue;
    }

    // Numbers
    if (/\d/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\d._]/.test(line[j])) j++;
      toks.push({ t: line.slice(i, j), k: "num" });
      i = j;
      continue;
    }

    // Identifiers / keywords / functions
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\w$]/.test(line[j])) j++;
      const w = line.slice(i, j);
      let k: TokenKind = "txt";
      if (kw.has(w)) k = "kw";
      else if (ty.has(w)) k = "ty";
      else if (j < line.length && line[j] === "(") k = "fn";
      toks.push({ t: w, k });
      i = j;
      continue;
    }

    // Multi-char operators
    const three = line.slice(i, i + 3);
    if (["===", "!==", "**="].includes(three)) {
      toks.push({ t: three, k: "op" });
      i += 3;
      continue;
    }
    const two = line.slice(i, i + 2);
    if (
      ["==", "!=", ">=", "<=", "=>", "&&", "||", "??", "?.", "**", "//"].includes(
        two,
      )
    ) {
      toks.push({ t: two, k: "op" });
      i += 2;
      continue;
    }

    // Single-char operators
    if ("=<>!+-*/&|?:%".includes(line[i])) {
      toks.push({ t: line[i], k: "op" });
      i++;
      continue;
    }

    toks.push({ t: line[i], k: "txt" });
    i++;
  }

  return toks;
}
