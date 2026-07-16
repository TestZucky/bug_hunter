import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSession } from "@/services/gameSession";
import { enforceRateLimit } from "@/lib/rate-limit";
import { describeError, logger } from "@/lib/logger";
import type { Language } from "@/types/challenge";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lang: z.enum(["javascript", "python", "mixed"]).optional(),
  count: z.number().int().min(1).max(50).optional(),
});

/**
 * POST /api/challenges/session { lang, count } → { sessionId, challenges }.
 * Creates a server-authoritative session and returns the answer-stripped queue.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "session", 30, 60_000);
  if (limited) return limited;

  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    const lang = (parsed.success && parsed.data.lang) || "mixed";
    const count = (parsed.success && parsed.data.count) || 20;
    const { sessionId, challenges } = await createSession(
      lang as Language | "mixed",
      count,
    );
    return NextResponse.json({ sessionId, challenges });
  } catch (err) {
    logger.error("POST /api/challenges/session failed", describeError(err));
    return NextResponse.json(
      { error: "Failed to start session" },
      { status: 500 },
    );
  }
}
