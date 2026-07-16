import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getById } from "@/db/challenges.repo";
import {
  buildReveal,
  isBugLineCorrect,
  isDiagnosisCorrect,
  isFixCorrect,
} from "@/services/challengeService";
import { enforceRateLimit } from "@/lib/rate-limit";
import { describeError, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  challengeId: z.string().min(1).max(128),
  kind: z.enum(["line", "diagnosis", "fix", "forfeit"]),
  selectedId: z.string().max(128).nullable(),
});

/**
 * POST /api/challenges/grade — grades a single submission on the server.
 * Answers never leave the server; only correctness (+ the round-end reveal,
 * which is the same explanation the game shows after every round) is returned.
 */
export async function POST(req: NextRequest) {
  // Throttle grading — this is the endpoint a scraper would hammer.
  const limited = enforceRateLimit(req, "grade", 300, 60_000);
  if (limited) return limited;

  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { challengeId, kind, selectedId } = parsed.data;
    const c = await getById(challengeId);
    if (!c) {
      return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
    }

    let correct = false;
    if (kind === "line") correct = isBugLineCorrect(c, selectedId);
    else if (kind === "diagnosis") correct = isDiagnosisCorrect(c, selectedId);
    else if (kind === "fix") correct = isFixCorrect(c, selectedId);
    // "forfeit" (timeout) → correct stays false.

    // The round resolves on anything except a correct line (which just advances
    // to the diagnosis stage). Reveal only on resolution.
    const resolves = !(kind === "line" && correct);
    const reveal = resolves ? buildReveal(c) : undefined;

    return NextResponse.json({ correct, reveal });
  } catch (err) {
    logger.error("POST /api/challenges/grade failed", describeError(err));
    return NextResponse.json({ error: "Grading failed" }, { status: 500 });
  }
}
