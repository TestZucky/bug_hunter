"use client";

import type { Language, PublicChallenge } from "@/types/challenge";
import type { GradeKind, GradeResult } from "@/types/game";

/** Fetch an answer-stripped challenge queue for a session. */
export async function fetchSessionChallenges(
  language: Language | "mixed",
  count: number,
): Promise<PublicChallenge[]> {
  const res = await fetch(
    `/api/challenges/session?lang=${encodeURIComponent(language)}&count=${count}`,
  );
  if (!res.ok) throw new Error(`session request failed (${res.status})`);
  const data = (await res.json()) as { challenges: PublicChallenge[] };
  return data.challenges;
}

/** Grade one submission on the server. */
export async function gradeStep(
  challengeId: string,
  kind: GradeKind,
  selectedId: string | null,
): Promise<GradeResult> {
  const res = await fetch("/api/challenges/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeId, kind, selectedId }),
  });
  if (!res.ok) throw new Error(`grade request failed (${res.status})`);
  return (await res.json()) as GradeResult;
}
