"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  toggleSound: () => void;
  toggleHaptics: () => void;
  toggleReducedMotion: () => void;
  setSound: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      hapticsEnabled: true,
      reducedMotion: false,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      toggleReducedMotion: () =>
        set((s) => ({ reducedMotion: !s.reducedMotion })),
      setSound: (v) => set({ soundEnabled: v }),
    }),
    { name: "bughunter.settings" },
  ),
);
