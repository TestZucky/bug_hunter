import { validateChallenges } from "@/schemas/challenge.schema";
import type { Challenge } from "@/types/challenge";
import { JAVASCRIPT_CHALLENGES } from "./javascript";
import { PYTHON_CHALLENGES } from "./python";

const ALL: Challenge[] = [...JAVASCRIPT_CHALLENGES, ...PYTHON_CHALLENGES];

// Validate content at module load. In dev/build this surfaces authoring
// mistakes (duplicate ids, missing correct answer, dangling bug line) early.
validateChallenges(ALL as unknown[]);

// Guard against duplicate challenge ids across files.
const ids = ALL.map((c) => c.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length > 0) {
  throw new Error(`Duplicate challenge ids: ${[...new Set(dupes)].join(", ")}`);
}

export const CHALLENGES: Challenge[] = ALL;
