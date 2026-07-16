"use client";

import { motion } from "motion/react";
import { CheckCircle, XCircle } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { TOKEN_COLORS, tokenize } from "@/lib/syntax";
import type { Language } from "@/types/challenge";
import type { GameStatus } from "@/types/game";

interface CodeEditorProps {
  title: string;
  filename: string;
  code: { id: string; content: string }[];
  language: Language;
  status: GameStatus;
  pendingLineId: string | null;
  correctLineId: string | null; // revealed only at round_result
  wrongLineId: string | null;
  outcome: "correct" | "incorrect" | "timeout" | null;
  shakeKey: number;
  onSelectLine: (lineId: string) => void;
}

const SELECTABLE = new Set(["inspecting", "line_selected"]);

export function CodeEditor({
  title,
  filename,
  code,
  language,
  status,
  pendingLineId,
  correctLineId,
  wrongLineId,
  outcome,
  shakeKey,
  onSelectLine,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectable = SELECTABLE.has(status);
  const revealing = status === "round_result";
  // During diagnose/fix the confirmed correct line stays locked-in.
  const locked = status === "diagnosing" || status === "fixing";

  const selectableIds = code.filter((l) => l.content.trim() !== "").map((l) => l.id);

  function moveFocus(delta: number, currentId: string) {
    const idx = selectableIds.indexOf(currentId);
    const nextIdx =
      (idx + delta + selectableIds.length) % selectableIds.length;
    const nextId = selectableIds[nextIdx];
    const el = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-line-id="${nextId}"]`,
    );
    el?.focus();
  }

  return (
    <motion.div
      className="flex-1 min-h-0 rounded-2xl border border-border overflow-hidden relative flex flex-col"
      style={{ background: "rgba(13,13,28,0.9)" }}
      key={`editor-${shakeKey}`}
      animate={
        shakeKey > 0 ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }
      }
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {/* Editor chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex gap-1.5" aria-hidden>
          <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "#fbbf24" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "#4ade80" }} />
        </div>
        <div className="flex-1 flex justify-center min-w-0">
          <span className="text-xs text-muted-foreground font-mono truncate">
            {filename}
          </span>
        </div>
        {selectable && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Click the buggy line
          </span>
        )}
      </div>

      {/* Lines */}
      <div
        ref={containerRef}
        className="py-4 overflow-auto scroll-slim flex-1 font-mono"
        role="listbox"
        aria-label={`Code for ${title}. Select the line containing the bug.`}
      >
        {code.map((line) => {
          const isSelected = pendingLineId === line.id;
          const isBug = correctLineId === line.id;
          const isWrongPick = wrongLineId === line.id;
          const empty = line.content.trim() === "";

          let rowBg = "transparent";
          let rowBorder = "transparent";
          if (locked && isSelected) {
            rowBg = "rgba(74,222,128,0.08)";
            rowBorder = "rgba(74,222,128,0.35)";
          } else if (isSelected && selectable) {
            rowBg = "rgba(99,102,241,0.1)";
            rowBorder = "rgba(99,102,241,0.4)";
          } else if (revealing && isBug && outcome === "correct") {
            rowBg = "rgba(74,222,128,0.08)";
            rowBorder = "rgba(74,222,128,0.3)";
          } else if (revealing && isBug) {
            rowBg = "rgba(251,191,36,0.06)";
            rowBorder = "rgba(251,191,36,0.3)";
          } else if (revealing && isWrongPick) {
            rowBg = "rgba(239,68,68,0.08)";
            rowBorder = "rgba(239,68,68,0.3)";
          }

          const lineNumber = code.indexOf(line) + 1;

          return (
            <button
              key={line.id}
              data-line-id={line.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={!selectable || empty}
              onClick={() => selectable && !empty && onSelectLine(line.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  moveFocus(1, line.id);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  moveFocus(-1, line.id);
                }
              }}
              className={cn(
                "w-full flex items-center px-4 py-0.5 text-left group relative",
                selectable && !empty ? "cursor-pointer" : "cursor-default",
                selectable && !empty && "hover:bg-[rgba(99,102,241,0.06)]",
              )}
              style={{
                background: rowBg,
                borderLeft: `2px solid ${rowBorder}`,
                minHeight: "1.75rem",
              }}
            >
              <span
                className="w-8 text-right mr-5 text-xs shrink-0 tabular-nums"
                style={{ color: "#374151" }}
                aria-hidden
              >
                {empty ? "" : lineNumber}
              </span>
              <span className="flex-1 text-sm leading-relaxed whitespace-pre">
                {tokenize(line.content, language).map((tok, j) => (
                  <span key={j} style={{ color: TOKEN_COLORS[tok.k] }}>
                    {tok.t}
                  </span>
                ))}
              </span>

              {selectable && !empty && (
                <span
                  className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity ml-2 text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: "rgba(99,102,241,0.2)", color: "#a78bfa" }}
                >
                  select
                </span>
              )}
              {revealing && isBug && outcome === "correct" && (
                <CheckCircle className="w-4 h-4 shrink-0 ml-2" style={{ color: "#4ade80" }} />
              )}
              {revealing && isWrongPick && (
                <XCircle className="w-4 h-4 shrink-0 ml-2" style={{ color: "#ef4444" }} />
              )}
              {revealing && isBug && outcome !== "correct" && (
                <span className="text-xs shrink-0 ml-2" style={{ color: "#fbbf24" }}>
                  ← bug here
                </span>
              )}
              {locked && isSelected && (
                <CheckCircle className="w-4 h-4 shrink-0 ml-2" style={{ color: "#4ade80" }} />
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
