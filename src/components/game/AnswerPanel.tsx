"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface AnswerItem {
  id: string;
  content: ReactNode;
}

interface AnswerPanelProps {
  heading: string;
  hint?: string;
  options: AnswerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  accent: string;
}

/** Shared multiple-choice panel for the Diagnose and Fix stages. */
export function AnswerPanel({
  heading,
  hint,
  options,
  selectedId,
  onSelect,
  accent,
}: AnswerPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-border p-4 shrink-0"
      style={{ background: "rgba(13,13,28,0.9)" }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label={heading}
      >
        {options.map((opt, i) => {
          const selected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border transition-colors",
                "hover:border-[color:var(--ring)]",
              )}
              style={{
                background: selected ? `${accent}1a` : "rgba(255,255,255,0.02)",
                borderColor: selected ? accent : "var(--border)",
              }}
            >
              <span
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                style={{
                  background: selected ? accent : "rgba(255,255,255,0.05)",
                  color: selected ? "#fff" : "#94a3b8",
                }}
                aria-hidden
              >
                {selected ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className="flex-1 min-w-0 text-sm text-foreground">
                {opt.content}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
