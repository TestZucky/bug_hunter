import { z } from "zod";

export const languageSchema = z.enum(["javascript", "python"]);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const categorySchema = z.enum([
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
]);

export const bugTypeSchema = z.enum([
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
]);

export const codeLineSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
});

export const diagnosisOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isCorrect: z.boolean(),
});

export const fixOptionSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  isCorrect: z.boolean(),
});

export const productionImpactSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: severitySchema,
  metric: z.string().min(1),
});

export const challengeSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    filename: z.string().min(1),
    language: languageSchema,
    difficulty: difficultySchema,
    category: categorySchema,
    bugType: bugTypeSchema,
    code: z.array(codeLineSchema).min(2),
    bugLineIds: z.array(z.string().min(1)).min(1),
    diagnosisOptions: z.array(diagnosisOptionSchema).min(2),
    fixOptions: z.array(fixOptionSchema).min(2),
    explanation: z.string().min(1),
    productionImpact: productionImpactSchema,
    estimatedTimeSeconds: z.number().int().positive(),
    baseScore: z.number().int().positive(),
    xpReward: z.number().int().positive(),
    tags: z.array(z.string()),
  })
  .superRefine((c, ctx) => {
    // Code line IDs must be unique.
    const ids = c.code.map((l) => l.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate code line ids in challenge "${c.id}"`,
      });
    }
    // Every bugLineId must reference an existing line.
    for (const bugId of c.bugLineIds) {
      if (!ids.includes(bugId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `bugLineId "${bugId}" not found in code of "${c.id}"`,
        });
      }
    }
    // Exactly one correct diagnosis.
    const correctDiag = c.diagnosisOptions.filter((o) => o.isCorrect).length;
    if (correctDiag !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Challenge "${c.id}" must have exactly one correct diagnosis (found ${correctDiag})`,
      });
    }
    // Exactly one correct fix.
    const correctFix = c.fixOptions.filter((o) => o.isCorrect).length;
    if (correctFix !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Challenge "${c.id}" must have exactly one correct fix (found ${correctFix})`,
      });
    }
  });

export type ValidatedChallenge = z.infer<typeof challengeSchema>;

/** Validate a batch of challenges; throws with a readable message on the first bad one. */
export function validateChallenges(raw: unknown[]): ValidatedChallenge[] {
  return raw.map((c, i) => {
    const result = challengeSchema.safeParse(c);
    if (!result.success) {
      const id =
        c && typeof c === "object" && "id" in c
          ? (c as { id: string }).id
          : `#${i}`;
      throw new Error(
        `Invalid challenge "${id}":\n${result.error.issues
          .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
          .join("\n")}`,
      );
    }
    return result.data;
  });
}
