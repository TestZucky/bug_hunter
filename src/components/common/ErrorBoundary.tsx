"use client";

import { Component, type ReactNode } from "react";
import { describeError, logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  /** Optional fallback; defaults to a simple reset card. */
  fallback?: (reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches render/runtime errors in the subtree so a game crash can't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    logger.error("ErrorBoundary caught an error", {
      ...describeError(error),
      componentStack: info?.componentStack ?? undefined,
    });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset);

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4" aria-hidden>
          🐛
        </div>
        <h1 className="text-lg font-bold mb-2">This round broke</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          The game hit an unexpected error. Restart to keep playing — your saved
          progress is intact.
        </p>
        <button
          onClick={this.reset}
          className="px-5 py-2.5 rounded-2xl font-semibold text-sm"
          style={{
            background: "linear-gradient(135deg, #6366f1, #7c3aed)",
            color: "#fff",
          }}
        >
          Restart
        </button>
      </div>
    );
  }
}
