"use client";

import Link from "next/link";
import { useEffect } from "react";
import { describeError, logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Route error boundary caught an error", {
      digest: error.digest,
      ...describeError(error),
    });
  }, [error]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4" aria-hidden>
        🐛
      </div>
      <h1 className="text-xl font-bold mb-2">Something crashed</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        An unexpected error interrupted the game. Your progress is saved locally
        — try again.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-2xl font-semibold text-sm"
          style={{
            background: "linear-gradient(135deg, #6366f1, #7c3aed)",
            color: "#fff",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-2xl font-semibold text-sm border border-border text-muted-foreground"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
