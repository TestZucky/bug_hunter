import {
  buildReveal,
  isBugLineCorrect,
  isDiagnosisCorrect,
  isFixCorrect,
} from "@/services/challengeService";
import type { Challenge } from "@/types/challenge";
import type { GradeKind, GradeResult } from "@/types/game";

/**
 * Synthetic test challenges — deliberately minimal and NOT the real question
 * bank (which lives only in the DB). Used to unit-test the pure logic and the
 * game state machine without a database.
 */
export const FIXTURE_CHALLENGES: Challenge[] = [
  {
    id: "fix-easy-1",
    title: "Off by one",
    filename: "a.js",
    language: "javascript",
    difficulty: "easy",
    category: "loops",
    bugType: "off_by_one",
    code: [
      { id: "l1", content: "for (let i = 0; i <= arr.length; i++) {" },
      { id: "l2", content: "  sum += arr[i];" },
      { id: "l3", content: "}" },
    ],
    bugLineIds: ["l1"],
    diagnosisOptions: [
      { id: "d1", label: "Loop overshoots the array end", isCorrect: true },
      { id: "d2", label: "sum is never initialized", isCorrect: false },
      { id: "d3", label: "arr is undefined", isCorrect: false },
    ],
    fixOptions: [
      {
        id: "f1",
        code: "for (let i = 0; i < arr.length; i++) {",
        isCorrect: true,
      },
      {
        id: "f2",
        code: "for (let i = 1; i <= arr.length; i++) {",
        isCorrect: false,
      },
    ],
    explanation: "Using <= reads one past the end.",
    productionImpact: {
      title: "Crash",
      description: "undefined access",
      severity: "medium",
      metric: "100 errors",
    },
    estimatedTimeSeconds: 20,
    baseScore: 100,
    xpReward: 20,
    tags: ["loops"],
  },
  {
    id: "fix-medium-1",
    title: "Missing await",
    filename: "b.js",
    language: "javascript",
    difficulty: "medium",
    category: "async",
    bugType: "missing_await",
    code: [
      { id: "l1", content: "const res = fetch(url);" },
      { id: "l2", content: "return res.json();" },
    ],
    bugLineIds: ["l1"],
    diagnosisOptions: [
      { id: "d1", label: "fetch is not awaited", isCorrect: true },
      { id: "d2", label: "url is undefined", isCorrect: false },
      { id: "d3", label: "json() takes an argument", isCorrect: false },
    ],
    fixOptions: [
      { id: "f1", code: "const res = await fetch(url);", isCorrect: true },
      { id: "f2", code: "const res = fetch.await(url);", isCorrect: false },
    ],
    explanation: "fetch returns a promise.",
    productionImpact: {
      title: "Broken",
      description: "pending promise used",
      severity: "high",
      metric: "500 sessions",
    },
    estimatedTimeSeconds: 15,
    baseScore: 200,
    xpReward: 35,
    tags: ["async"],
  },
  {
    id: "fix-hard-1",
    title: "None check",
    filename: "c.py",
    language: "python",
    difficulty: "hard",
    category: "null_handling",
    bugType: "null_reference",
    code: [
      { id: "l1", content: "name = user.get('name')" },
      { id: "l2", content: "return name.upper()" },
    ],
    bugLineIds: ["l2"],
    diagnosisOptions: [
      { id: "d1", label: "name may be None", isCorrect: true },
      { id: "d2", label: "get should be pop", isCorrect: false },
      { id: "d3", label: "upper needs parens", isCorrect: false },
    ],
    fixOptions: [
      { id: "f1", code: "return (name or '').upper()", isCorrect: true },
      { id: "f2", code: "return name.upper() or None", isCorrect: false },
    ],
    explanation: "None has no .upper().",
    productionImpact: {
      title: "AttributeError",
      description: "None.upper()",
      severity: "medium",
      metric: "50/day",
    },
    estimatedTimeSeconds: 10,
    baseScore: 350,
    xpReward: 60,
    tags: ["none"],
  },
];

/** A local grader that mirrors the /api/challenges/grade route, for tests. */
export function localGrader(pool: Challenge[]) {
  return async (
    challengeId: string,
    kind: GradeKind,
    selectedId: string | null,
  ): Promise<GradeResult> => {
    const c = pool.find((x) => x.id === challengeId);
    if (!c) throw new Error(`unknown challenge ${challengeId}`);
    let correct = false;
    if (kind === "line") correct = isBugLineCorrect(c, selectedId);
    else if (kind === "diagnosis") correct = isDiagnosisCorrect(c, selectedId);
    else if (kind === "fix") correct = isFixCorrect(c, selectedId);
    const resolves = !(kind === "line" && correct);
    return { correct, reveal: resolves ? buildReveal(c) : undefined };
  };
}
