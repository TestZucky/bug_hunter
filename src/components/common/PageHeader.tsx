"use client";

import Link from "next/link";
import { ArrowLeft, Bug } from "lucide-react";

export function PageHeader({ title }: { title?: string }) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
      <Link href="/" className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa)" }}
        >
          <Bug className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold tracking-tight hidden sm:inline">
          Bug<span style={{ color: "#6366f1" }}>Hunter</span>
        </span>
      </Link>
      {title && <span className="font-semibold text-sm">{title}</span>}
      <Link
        href="/"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors text-sm"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>
    </header>
  );
}
