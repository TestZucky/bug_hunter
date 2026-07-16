"use client";

import { useEffect, useState } from "react";

/**
 * Returns false during SSR and the first client render, then true after mount.
 * Use to gate UI that depends on persisted (localStorage) store values so the
 * server-rendered HTML matches the client's first paint and avoids hydration
 * mismatches.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
