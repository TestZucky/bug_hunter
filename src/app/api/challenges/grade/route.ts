import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { gradeInSession } from "@/services/gameSession";
import { enforceRateLimit } from "@/lib/rate-limit";
import { describeError, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  roundIndex: z.number().int().min(0).max(100_000),
  kind: z.enum(["line", "diagnosis", "fix", "forfeit"]),
  selectedId: z.string().max(128).nullable(),
});

/**
 * POST /api/challenges/grade — grades a submission WITHIN a session. The server
 * enforces round/stage order, so a client gets exactly one answer per stage and
 * cannot enumerate a challenge's options. Reveal is returned only on resolve.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "grade", 300, 60_000);
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
    const { sessionId, roundIndex, kind, selectedId } = parsed.data;
    const r = await gradeInSession(sessionId, roundIndex, kind, selectedId);
    if (r.status === "notfound") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (r.status === "conflict") {
      return NextResponse.json(
        { error: "Round already submitted or out of order" },
        { status: 409 },
      );
    }
    return NextResponse.json({ correct: r.correct, reveal: r.reveal });
  } catch (err) {
    logger.error("POST /api/challenges/grade failed", describeError(err));
    return NextResponse.json({ error: "Grading failed" }, { status: 500 });
  }
}
