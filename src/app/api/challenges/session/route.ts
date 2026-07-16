import { NextResponse, type NextRequest } from "next/server";
import { buildRun } from "@/db/challenges.repo";
import { toPublicChallenge } from "@/services/challengeService";
import { enforceRateLimit } from "@/lib/rate-limit";
import { describeError, logger } from "@/lib/logger";
import type { Language } from "@/types/challenge";

export const dynamic = "force-dynamic";

/** GET /api/challenges/session?lang=javascript&count=20 → answer-stripped queue. */
export async function GET(req: NextRequest) {
  // Starting a session is expensive (a DB query per call); throttle it.
  const limited = enforceRateLimit(req, "session", 30, 60_000);
  if (limited) return limited;

  try {
    const p = req.nextUrl.searchParams;
    const langParam = p.get("lang");
    const language: Language | "mixed" =
      langParam === "python"
        ? "python"
        : langParam === "javascript"
          ? "javascript"
          : "mixed";
    const count = Math.min(50, Math.max(1, Number(p.get("count") ?? 20)));

    const full = await buildRun(language, count);
    // Strip answers before anything leaves the server.
    const challenges = full.map(toPublicChallenge);
    return NextResponse.json({ challenges });
  } catch (err) {
    logger.error("GET /api/challenges/session failed", describeError(err));
    return NextResponse.json(
      { error: "Failed to load challenges" },
      { status: 500 },
    );
  }
}
