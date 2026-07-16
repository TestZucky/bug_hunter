"use client";

import { useSearchParams } from "next/navigation";
import { SimpleGame } from "@/components/game/SimpleGame";
import type { Language } from "@/types/challenge";

export function PlayClient() {
  const params = useSearchParams();
  const langParam = params.get("lang");
  const language: Language | "mixed" =
    langParam === "python"
      ? "python"
      : langParam === "javascript"
      ? "javascript"
      : "mixed";

  return <SimpleGame language={language} key={language} />;
}
