import { buildRun, getById } from "@/db/challenges.repo";
import { getKv } from "@/lib/kv";
import {
  buildReveal,
  isBugLineCorrect,
  isDiagnosisCorrect,
  isFixCorrect,
  toPublicChallenge,
} from "@/services/challengeService";
import type { Language, PublicChallenge } from "@/types/challenge";
import type { GradeKind, RevealPayload } from "@/types/game";

/**
 * Server-authoritative game sessions (anti-cheat). The server owns the round/
 * stage state, so a client can only submit ONE answer per stage per round —
 * a wrong guess ends the round server-side and cannot be retried. This closes
 * answer enumeration: you can't probe a challenge's options via the API.
 */

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const key = (id: string) => `sess:${id}`;

interface ServerSession {
  queueIds: string[];
  round: number;
  stage: "line" | "diagnosis" | "fix" | "done";
  skipFix: boolean;
}

export interface CreatedSession {
  sessionId: string;
  challenges: PublicChallenge[];
}

/** Create a session: build a run, store server state, return answer-stripped challenges. */
export async function createSession(
  language: Language | "mixed",
  count: number,
  skipFix = true,
): Promise<CreatedSession> {
  const full = await buildRun(language, count);
  const sessionId = crypto.randomUUID();
  const state: ServerSession = {
    queueIds: full.map((c) => c.id),
    round: 0,
    stage: "line",
    skipFix,
  };
  await getKv().setJSON(key(sessionId), state, SESSION_TTL_MS);
  return { sessionId, challenges: full.map(toPublicChallenge) };
}

export type GradeStatus = "ok" | "notfound" | "conflict";
export interface GradeOutcome {
  status: GradeStatus;
  correct?: boolean;
  reveal?: RevealPayload;
}

/**
 * Grade one submission within a session, enforcing round/stage order.
 * Rejects replays and out-of-order/extra submissions with `conflict`.
 */
export async function gradeInSession(
  sessionId: string,
  roundIndex: number,
  kind: GradeKind,
  selectedId: string | null,
): Promise<GradeOutcome> {
  const kv = getKv();
  const s = await kv.getJSON<ServerSession>(key(sessionId));
  if (!s) return { status: "notfound" };

  // Advance to the next round only when the previous one is resolved.
  if (roundIndex === s.round + 1 && s.stage === "done") {
    s.round = roundIndex;
    s.stage = "line";
  }

  if (roundIndex !== s.round) return { status: "conflict" };
  if (s.stage === "done") return { status: "conflict" }; // already resolved
  if (kind !== "forfeit" && kind !== s.stage) return { status: "conflict" };

  const challengeId = s.queueIds[roundIndex % s.queueIds.length];
  const c = await getById(challengeId);
  if (!c) return { status: "notfound" };

  let correct = false;
  if (kind === "line") correct = isBugLineCorrect(c, selectedId);
  else if (kind === "diagnosis") correct = isDiagnosisCorrect(c, selectedId);
  else if (kind === "fix") correct = isFixCorrect(c, selectedId);

  let reveal: RevealPayload | undefined;
  if (kind === "line" && correct) {
    s.stage = "diagnosis"; // advance, no reveal
  } else if (kind === "diagnosis" && correct && !s.skipFix) {
    s.stage = "fix"; // advance, no reveal
  } else {
    s.stage = "done"; // resolved (win or loss) → reveal is the post-round explanation
    reveal = buildReveal(c);
  }

  await kv.setJSON(key(sessionId), s, SESSION_TTL_MS);
  return { status: "ok", correct, reveal };
}
