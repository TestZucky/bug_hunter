import { DIFFICULTY_CONFIG } from "@/lib/constants";
import type {
  BugType,
  Category,
  Challenge,
  Difficulty,
  Language,
  Severity,
} from "@/types/challenge";

interface RawChallenge {
  id: string;
  title: string;
  filename: string;
  language: Language;
  difficulty: Difficulty;
  category: Category;
  bugType: BugType;
  /** Source lines; ids l1..lN are assigned automatically. */
  code: string[];
  /** 1-indexed line numbers containing the bug. */
  bugLines: number[];
  /** [label, isCorrect] — exactly one correct. */
  diagnosis: [string, boolean][];
  /** [code, isCorrect] — exactly one correct. */
  fixes: [string, boolean][];
  explanation: string;
  impact: {
    title: string;
    description: string;
    severity: Severity;
    metric: string;
  };
  tags: string[];
  /** Optional overrides for scoring defaults. */
  baseScore?: number;
  xpReward?: number;
  timeSeconds?: number;
}

let diagCounter = 0;
let fixCounter = 0;

/** Build a fully-typed Challenge from a compact authoring shape. */
export function challenge(raw: RawChallenge): Challenge {
  const cfg = DIFFICULTY_CONFIG[raw.difficulty];
  const code = raw.code.map((content, i) => ({ id: `l${i + 1}`, content }));
  const bugLineIds = raw.bugLines.map((n) => `l${n}`);

  const diagnosisOptions = raw.diagnosis.map(([label, isCorrect]) => ({
    id: `d${++diagCounter}`,
    label,
    isCorrect,
  }));

  const fixOptions = raw.fixes.map(([codeStr, isCorrect]) => ({
    id: `f${++fixCounter}`,
    code: codeStr,
    isCorrect,
  }));

  return {
    id: raw.id,
    title: raw.title,
    filename: raw.filename,
    language: raw.language,
    difficulty: raw.difficulty,
    category: raw.category,
    bugType: raw.bugType,
    code,
    bugLineIds,
    diagnosisOptions,
    fixOptions,
    explanation: raw.explanation,
    productionImpact: raw.impact,
    estimatedTimeSeconds: raw.timeSeconds ?? cfg.timeSeconds,
    baseScore: raw.baseScore ?? cfg.baseScore,
    xpReward: raw.xpReward ?? cfg.xpReward,
    tags: raw.tags,
  };
}
