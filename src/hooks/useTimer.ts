"use client";

import { useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";

const ACTIVE = new Set(["inspecting", "line_selected", "diagnosing", "fixing"]);

/** Drives the round countdown by calling the store's tick() once per second. */
export function useTimer() {
  const status = useGameStore((s) => s.status);
  const tick = useGameStore((s) => s.tick);

  useEffect(() => {
    if (!ACTIVE.has(status)) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [status, tick]);
}
