export type Language = "javascript" | "python";

export type Difficulty = "easy" | "medium" | "hard";

export type Severity = "low" | "medium" | "high" | "critical";

export type Category =
  | "syntax"
  | "variables"
  | "conditions"
  | "loops"
  | "arrays"
  | "functions"
  | "null_handling"
  | "async"
  | "api"
  | "sql"
  | "security"
  | "react"
  | "state"
  | "performance"
  | "error_handling"
  | "testing";

export type BugType =
  | "syntax_error"
  | "off_by_one"
  | "null_reference"
  | "undefined_access"
  | "wrong_condition"
  | "infinite_loop"
  | "missing_return"
  | "incorrect_mutation"
  | "missing_await"
  | "unhandled_promise"
  | "race_condition"
  | "sql_injection"
  | "xss"
  | "authentication_error"
  | "authorization_error"
  | "memory_leak"
  | "performance_issue"
  | "incorrect_query"
  | "wrong_http_method"
  | "wrong_status_code"
  | "stale_state"
  | "resource_leak"
  | "type_mismatch"
  | "loose_equality";

export interface CodeLine {
  /** Stable identifier, e.g. "l4". */
  id: string;
  /** Raw source for this line (indentation preserved). */
  content: string;
}

export interface DiagnosisOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface FixOption {
  id: string;
  code: string;
  isCorrect: boolean;
}

export interface ProductionImpact {
  title: string;
  description: string;
  severity: Severity;
  metric: string;
}

/** The full authored challenge, including answer keys. Never sent to the client raw. */
export interface Challenge {
  id: string;
  title: string;
  filename: string;
  language: Language;
  difficulty: Difficulty;
  category: Category;
  bugType: BugType;
  code: CodeLine[];
  bugLineIds: string[];
  diagnosisOptions: DiagnosisOption[];
  fixOptions: FixOption[];
  explanation: string;
  productionImpact: ProductionImpact;
  estimatedTimeSeconds: number;
  baseScore: number;
  xpReward: number;
  tags: string[];
}

/** The answer-safe projection delivered to the game UI (no correctness flags). */
export interface PublicChallenge {
  id: string;
  title: string;
  filename: string;
  language: Language;
  difficulty: Difficulty;
  category: Category;
  bugType: BugType;
  code: CodeLine[];
  diagnosisOptions: { id: string; label: string }[];
  fixOptions: { id: string; code: string }[];
  estimatedTimeSeconds: number;
  baseScore: number;
  xpReward: number;
  tags: string[];
}
