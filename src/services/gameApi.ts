"use client";

import type { Language, PublicChallenge } from "@/types/challenge";
import type { GradeKind, GradeResult } from "@/types/game";

export interface SessionResponse {
  sessionId: string;
  challenges: PublicChallenge[];
}

/** Create a server session and fetch its answer-stripped challenge queue. */
export async function createSession(
  language: Language | "mixed",
  count: number,
): Promise<SessionResponse> {
  const res = await fetch("/api/challenges/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lang: language, count }),
  });
  if (!res.ok) throw new Error(`session request failed (${res.status})`);
  return (await res.json()) as SessionResponse;
}

/** Grade one submission within a session (server enforces round/stage order). */
export async function gradeStep(
  sessionId: string,
  roundIndex: number,
  kind: GradeKind,
  selectedId: string | null,
): Promise<GradeResult> {
  const res = await fetch("/api/challenges/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, roundIndex, kind, selectedId }),
  });
  if (!res.ok) throw new Error(`grade request failed (${res.status})`);
  return (await res.json()) as GradeResult;
}
