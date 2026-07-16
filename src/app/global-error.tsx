"use client";

import { useEffect } from "react";
import { describeError, logger } from "@/lib/logger";

/**
 * Root-level error boundary. Replaces the whole document when the root layout
 * itself throws, so it must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Global error boundary caught an error", {
      digest: error.digest,
      ...describeError(error),
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#07070f",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💥</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            The app hit a fatal error
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>
            Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 16,
              fontWeight: 600,
              fontSize: 14,
              color: "#fff",
              background: "linear-gradient(135deg, #6366f1, #7c3aed)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
